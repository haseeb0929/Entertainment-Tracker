import axios from "axios";
import express from "express";
import getSpotifyToken from "../utils/spotify.js";
import Profile from "../models/Profile.js";
import User from "../models/User.js";
const router = express.Router();

// 🔹 Country → Region label mapper (aligned with UI labels)
const countryToRegion = (countryCode) => {
    if (!countryCode) return "Unknown";
    const regions = {
        // Americas grouped as "Hollywood"
        US: "Hollywood",
        CA: "Hollywood",
        MX: "Hollywood",
        BR: "Hollywood",
        AR: "Hollywood",
        CL: "Hollywood",

        // UK explicitly labeled as "British"
        GB: "British",

        // Europe
        FR: "European",
        DE: "European",
        IT: "European",
        ES: "European",
        NL: "European",
        SE: "European",
        NO: "European",
        DK: "European",
        FI: "European",
        PL: "European",

        // South/West Asia (Bollywood for IN/PK)
        IN: "Bollywood",
        PK: "Bollywood",

        // East Asia
        KR: "Korean",
        JP: "Japanese",
        CN: "Asian",
        TW: "Asian",
        HK: "Asian",
        TH: "Asian",
        ID: "Asian",
        VN: "Asian",

        // Africa & Oceania (not in UI options but kept for completeness)
        NG: "Africa",
        ZA: "Africa",
        EG: "Africa",
        MA: "Africa",
        AU: "Oceania",
        NZ: "Oceania",
    };
    return regions[countryCode] || "Other";
};

// 🔹 Language → Representative country code (best-effort fallback for movies)
const languageToCountry = (lang) => {
    const map = {
        en: "US",
        hi: "IN",
        ur: "PK",
        ko: "KR",
        ja: "JP",
        zh: "CN",
        yue: "HK",
        fr: "FR",
        de: "DE",
        es: "ES",
        it: "IT",
        pt: "BR",
        ru: "RU",
        ar: "EG",
        tr: "TR",
        fa: "IR",
        nl: "NL",
        sv: "SE",
        no: "NO",
        da: "DK",
        fi: "FI",
        pl: "PL",
    };
    return map[String(lang || '').toLowerCase()] || null;
};

// 🔹 UI Region label → representative ISO country codes
const regionLabelToCountryCodes = (label) => {
    const key = String(label || '').toLowerCase();
    const map = {
        hollywood: ["US"],
        bollywood: ["IN"],
        british: ["GB"],
        korean: ["KR"],
        japanese: ["JP"],
        european: ["FR","DE","IT","ES","NL","SE","NO","DK","FI","PL"],
        asian: ["JP","KR","CN","IN","PK","TH","ID","VN"],
    };
    return map[key] || [];
};

// 🔹 Normalize UI genre names to TMDB genre names
const normalizeGenreName = (name) => {
    const n = String(name || '').toLowerCase();
    if (n === 'sci-fi' || n === 'sci fi' || n === 'science-fiction') return 'Science Fiction';
    return name;
};

// Simple in-memory cache with TTL
const cache = new Map(); // key -> { data, expiresAt }
const getCache = (key) => {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
        cache.delete(key);
        return null;
    }
    return hit.data;
};
const setCache = (key, data, ttlMs = 2 * 60 * 1000) => {
    cache.set(key, { data, expiresAt: Date.now() + ttlMs });
};

// Fetch wrapper with timeout and limited retries
async function fetchJsonWithRetry(url, options = {}, { retries = 1, timeoutMs = 8000 } = {}) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timer);
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
            }
            return await res.json();
        } catch (err) {
            clearTimeout(timer);
            if (attempt === retries) throw err;
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
    }
}

// Helpers used for the "all" aggregator
async function _moviesFromTMDB(search, genre, region) {
    const TMDB_KEY = process.env.TMDB_API_KEY || "d3d929a444c71be2e820a0403ada5a84";
    const TMDB_TOKEN = process.env.TMDB_READ_TOKEN || "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkM2Q5MjlhNDQ0YzcxYmUyZTgyMGEwNDAzYWRhNWE4NCIsIm5iZiI6MTc2MzM5NTI2Mi43MDQsInN1YiI6IjY5MWI0NmJlNDEwZjUzNTQwY2M3Y2ZiOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.E54bicFBrnHFaRmR3W1HvR7S66cik3ShXoAYBewQOSY";
    const genreResp = await fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_KEY}&language=en-US`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
    const genreJson = await genreResp.json();
    const genreMap = new Map((genreJson.genres || []).map(g => [g.id, g.name]));
    let url;
    const params = new URLSearchParams();
    if (search && search.trim() !== "" && search !== "react") {
        url = "https://api.themoviedb.org/3/search/movie";
        params.set("query", search);
        params.set("include_adult", "false");
        params.set("language", "en-US");
        params.set("page", "1");
    } else {
        url = "https://api.themoviedb.org/3/discover/movie";
        params.set("language", "en-US");
        params.set("page", "1");
        params.set("sort_by", "popularity.desc");
    }
    if (genre && genre.toLowerCase() !== "all") {
        const wanted = normalizeGenreName(genre);
        const entry = Array.from(genreMap.entries()).find(([, name]) => String(name).toLowerCase() === String(wanted).toLowerCase());
        if (entry) params.set("with_genres", String(entry[0]));
    }
    // When discovering (no search), push region down to TMDB if possible
    if ((!search || search === "react") && region && region.toLowerCase() !== "all") {
        const codes = regionLabelToCountryCodes(region);
        if (codes.length > 0) {
            // OR semantics with '|'
            params.set("with_origin_country", codes.join("|"));
        }
    }
    const tmdbRes = await fetch(`${url}?${params.toString()}`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
    const tmdbData = await tmdbRes.json();
    const results = Array.isArray(tmdbData.results) ? tmdbData.results : [];
    let out = results.map((m) => {
        const country = (m.origin_country && m.origin_country[0]) || languageToCountry(m.original_language) || "Unknown";
        const poster = m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "";
        const backdrop = m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : poster;
        const gname = (m.genre_ids && m.genre_ids.length > 0) ? (genreMap.get(m.genre_ids[0]) || "Unknown") : "Unknown";
        return {
            id: m.id,
            type: "movies",
            title: m.title || m.original_title || "Unknown Title",
            rating: typeof m.vote_average === "number" ? Number(m.vote_average.toFixed(1)) : 0,
            genre: gname,
            region: countryToRegion(country),
            country,
            trending: Boolean(m.popularity && m.popularity > 100),
            thumbnail: poster || backdrop,
            description: m.overview || "",
            language: m.original_language || undefined,
        };
    });
    if (region && region.toLowerCase() !== "all") {
        out = out.filter((m) => m.region.toLowerCase() === region.toLowerCase());
    }
    return out;
}

async function _seriesFromTMDB(search, genre, region) {
    const TMDB_KEY = process.env.TMDB_API_KEY || "d3d929a444c71be2e820a0403ada5a84";
    const TMDB_TOKEN = process.env.TMDB_READ_TOKEN || "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkM2Q5MjlhNDQ0YzcxYmUyZTgyMGEwNDAzYWRhNWE4NCIsIm5iZiI6MTc2MzM5NTI2Mi43MDQsInN1YiI6IjY5MWI0NmJlNDEwZjUzNTQwY2M3Y2ZiOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.E54bicFBrnHFaRmR3W1HvR7S66cik3ShXoAYBewQOSY";
    const genreResp = await fetch(`https://api.themoviedb.org/3/genre/tv/list?api_key=${TMDB_KEY}&language=en-US`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
    const genreJson = await genreResp.json();
    const genreMap = new Map((genreJson.genres || []).map(g => [g.id, g.name]));
    let url;
    const params = new URLSearchParams();
    if (search && search.trim() !== "" && search !== "react") {
        url = "https://api.themoviedb.org/3/search/tv";
        params.set("query", search);
        params.set("include_adult", "false");
        params.set("language", "en-US");
        params.set("page", "1");
    } else {
        url = "https://api.themoviedb.org/3/discover/tv";
        params.set("language", "en-US");
        params.set("page", "1");
        params.set("sort_by", "popularity.desc");
    }
    if (genre && genre.toLowerCase() !== "all") {
        const wanted = normalizeGenreName(genre);
        const entry = Array.from(genreMap.entries()).find(([, name]) => String(name).toLowerCase() === String(wanted).toLowerCase());
        if (entry) params.set("with_genres", String(entry[0]));
    }
    if ((!search || search === "react") && region && region.toLowerCase() !== "all") {
        const codes = regionLabelToCountryCodes(region);
        if (codes.length > 0) params.set("with_origin_country", codes.join("|"));
    }
    const tmdbRes = await fetch(`${url}?${params.toString()}`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
    const tmdbData = await tmdbRes.json();
    const results = Array.isArray(tmdbData.results) ? tmdbData.results : [];
    let out = results.map((t) => {
        const country = (t.origin_country && t.origin_country[0]) || languageToCountry(t.original_language) || "Unknown";
        const poster = t.poster_path ? `https://image.tmdb.org/t/p/w500${t.poster_path}` : "";
        const backdrop = t.backdrop_path ? `https://image.tmdb.org/t/p/w780${t.backdrop_path}` : poster;
        const gname = (t.genre_ids && t.genre_ids.length > 0) ? (genreMap.get(t.genre_ids[0]) || "Unknown") : "Unknown";
        return {
            id: t.id,
            type: "series",
            title: t.name || t.original_name || "Unknown Title",
            rating: typeof t.vote_average === "number" ? Number(t.vote_average.toFixed(1)) : 0,
            genre: gname,
            region: countryToRegion(country),
            country,
            trending: Boolean(t.popularity && t.popularity > 100),
            thumbnail: poster || backdrop,
            description: t.overview || "",
            language: t.original_language || undefined,
        };
    });
    if (region && region.toLowerCase() !== "all") {
        out = out.filter((m) => m.region.toLowerCase() === region.toLowerCase());
    }
    return out;
}

async function _booksFromGoogle(search, genre, region) {
    const key = `books:${search || ''}:${genre || 'all'}:${region || 'all'}`;
    const cached = getCache(key);
    if (cached) return cached;
    const fields = encodeURIComponent("items(id,volumeInfo/title,volumeInfo/averageRating,volumeInfo/categories,volumeInfo/imageLinks/thumbnail,volumeInfo/authors,volumeInfo/description),items/saleInfo/country");
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(search || 'react')}&maxResults=32&fields=${fields}`;
    const data = await fetchJsonWithRetry(url, {}, { retries: 1, timeoutMs: 7000 });
    let out = (data.items || []).map((item) => {
        const country = item.saleInfo?.country || "Unknown";
        return {
            id: item.id,
            type: "books",
            title: item.volumeInfo.title || "Unknown Title",
            rating: item.volumeInfo.averageRating || 0,
            genre: item.volumeInfo.categories?.[0] || "Unknown",
            region: countryToRegion(country),
            country,
            trending: false,
            thumbnail: item.volumeInfo.imageLinks?.thumbnail || "",
            authors: item.volumeInfo.authors || [],
            description: item.volumeInfo.description || "",
        };
    });
    if (genre && genre.toLowerCase() !== "all") {
        out = out.filter((b) => (b.genre || '').toLowerCase() === genre.toLowerCase());
    }
    if (region && region.toLowerCase() !== "all") {
        out = out.filter((b) => (b.region || '').toLowerCase() === region.toLowerCase());
    }
    setCache(key, out);
    return out;
}

async function _animeFromTMDB(search, genre, region) {
    const TMDB_KEY = process.env.TMDB_API_KEY || "d3d929a444c71be2e820a0403ada5a84";
    const TMDB_TOKEN = process.env.TMDB_READ_TOKEN || "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkM2Q5MjlhNDQ0YzcxYmUyZTgyMGEwNDAzYWRhNWE4NCIsIm5iZiI6MTc2MzM5NTI2Mi43MDQsInN1YiI6IjY5MWI0NmJlNDEwZjUzNTQwY2M3Y2ZiOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.E54bicFBrnHFaRmR3W1HvR7S66cik3ShXoAYBewQOSY";
    // Get TV genres to map ids -> names
    const genreResp = await fetch(`https://api.themoviedb.org/3/genre/tv/list?api_key=${TMDB_KEY}&language=en-US`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
    const genreJson = await genreResp.json();
    const genreMap = new Map((genreJson.genres || []).map(g => [g.id, g.name]));

    let url;
    const params = new URLSearchParams();
    const wantSearch = (search && search.trim() !== "" && search !== "react");
    if (wantSearch) {
        url = "https://api.themoviedb.org/3/search/tv";
        params.set("query", search);
        params.set("include_adult", "false");
        params.set("language", "en-US");
        params.set("page", "1");
    } else {
        url = "https://api.themoviedb.org/3/discover/tv";
        params.set("language", "en-US");
        params.set("page", "1");
        params.set("sort_by", "popularity.desc");
        // Force Animation genre (16)
        params.set("with_genres", "16");
        // Prefer Japanese origin when region is set
        if (region && region.toLowerCase() !== "all") {
            const codes = regionLabelToCountryCodes(region);
            const arr = codes.length ? codes : ["JP"];
            params.set("with_origin_country", arr.join("|"));
        } else {
            params.set("with_origin_country", "JP|KR|CN");
        }
    }
    const tmdbRes = await fetch(`${url}?${params.toString()}`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
    const tmdbData = await tmdbRes.json();
    const results = Array.isArray(tmdbData.results) ? tmdbData.results : [];
    let out = results
        .filter(t => {
            if (!wantSearch) return true; // discover already constrained
            const hasAnim = Array.isArray(t.genre_ids) && t.genre_ids.includes(16);
            const jpish = (t.origin_country && t.origin_country.includes("JP")) || (t.original_language === 'ja');
            return hasAnim || jpish;
        })
        .map((t) => {
            const country = (t.origin_country && t.origin_country[0]) || languageToCountry(t.original_language) || "Unknown";
            const poster = t.poster_path ? `https://image.tmdb.org/t/p/w500${t.poster_path}` : "";
            const backdrop = t.backdrop_path ? `https://image.tmdb.org/t/p/w780${t.backdrop_path}` : poster;
            const gname = (t.genre_ids && t.genre_ids.length > 0) ? (genreMap.get(t.genre_ids[0]) || "Animation") : "Animation";
            return {
                id: t.id,
                type: "anime",
                title: t.name || t.original_name || "Unknown Title",
                rating: typeof t.vote_average === "number" ? Number(t.vote_average.toFixed(1)) : 0,
                genre: gname,
                region: countryToRegion(country),
                country,
                trending: Boolean(t.popularity && t.popularity > 100),
                thumbnail: poster || backdrop,
                description: t.overview || "",
                language: t.original_language || undefined,
            };
        });
    if (region && region.toLowerCase() !== "all") {
        out = out.filter((m) => (m.region || '').toLowerCase() === region.toLowerCase());
    }
    if (genre && genre.toLowerCase() !== 'all') {
        out = out.filter((m) => String(m.genre || '').toLowerCase() === String(normalizeGenreName(genre)).toLowerCase());
    }
    return out;
}

async function _musicFromSpotify(search) {
    const key = `music:${search || ''}`;
    const cached = getCache(key);
    if (cached) return cached;
    const token = await getSpotifyToken();
    const q = (!search || search === 'react') ? 'Alan walker' : search;
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=20`;
    const source = axios.CancelToken.source();
    const timer = setTimeout(() => source.cancel("timeout"), 8000);
    try {
        const response = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, cancelToken: source.token });
        const tracksArray = response.data?.tracks?.items || [];
        const out = tracksArray.map(track => {
            const album = track.album;
            const artistNames = track.artists.map(a => a.name);
            return {
                id: track.id,
                type: "music",
                title: track.name,
                rating: track.popularity || 0,
                genre: "Unknown",
                region: "Global",
                country: "Unknown",
                trending: (track.popularity || 0) > 70,
                thumbnail: album.images[0]?.url || "",
                description: album.name || "",
                artists: artistNames,
                album: album.name,
                release_date: album.release_date,
                preview_url: track.preview_url,
                spotifyUrl: track.external_urls.spotify,
                popularity: track.popularity
            };
        });
        setCache(key, out);
        return out;
    } finally {
        clearTimeout(timer);
    }
}

router.get("/items", async (req, res) => {
    let { search, type, genre, region } = req.query;
    if (!search || search.trim() === "") {
        search = "react"; // default fallback
    }

    try {
        // ========== BOOKS ==========
        if (type === "books") {
            const key = `books:${search || ''}:${genre || 'all'}:${region || 'all'}`;
            const cached = getCache(key);
            if (cached) { res.status(200); return res.json(cached); }

            // Limit fields to reduce payload size
            const fields = encodeURIComponent("items(id,volumeInfo/title,volumeInfo/averageRating,volumeInfo/categories,volumeInfo/imageLinks/thumbnail,volumeInfo/authors,volumeInfo/description),items/saleInfo/country");
            const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(search)}&maxResults=32&fields=${fields}`;
            const data = await fetchJsonWithRetry(url, {}, { retries: 1, timeoutMs: 7000 });

            let filteredBooks = (data.items || []).map((item) => {
                const country = item.saleInfo?.country || "Unknown";
                return {
                    id: item.id,
                    type: "books",
                    title: item.volumeInfo.title || "Unknown Title",
                    rating: item.volumeInfo.averageRating || 0,
                    genre: item.volumeInfo.categories?.[0] || "Unknown",
                    region: countryToRegion(country),
                    country,
                    trending: false,
                    thumbnail: item.volumeInfo.imageLinks?.thumbnail || "",
                    authors: item.volumeInfo.authors || [],
                    description: item.volumeInfo.description || "",
                };
            });

            if (genre && genre.toLowerCase() !== "all") {
                filteredBooks = filteredBooks.filter(
                    (b) => b.genre.toLowerCase() === genre.toLowerCase()
                );
            }
            if (region && region.toLowerCase() !== "all") {
                filteredBooks = filteredBooks.filter(
                    (b) => b.region.toLowerCase() === region.toLowerCase()
                );
            }
            setCache(key, filteredBooks);
            res.status(200);
            return res.json(filteredBooks);
        }

        // ========== MOVIES (TMDB) ==========
        if (type === "movies") {
            const TMDB_KEY = process.env.TMDB_API_KEY || "d3d929a444c71be2e820a0403ada5a84";
            const TMDB_TOKEN = process.env.TMDB_READ_TOKEN || "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkM2Q5MjlhNDQ0YzcxYmUyZTgyMGEwNDAzYWRhNWE4NCIsIm5iZiI6MTc2MzM5NTI2Mi43MDQsInN1YiI6IjY5MWI0NmJlNDEwZjUzNTQwY2M3Y2ZiOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.E54bicFBrnHFaRmR3W1HvR7S66cik3ShXoAYBewQOSY";

            // Fetch genre list map for movies
            const genreResp = await fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_KEY}&language=en-US`, {
                headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
            });
            const genreJson = await genreResp.json();
            const genreMap = new Map((genreJson.genres || []).map(g => [g.id, g.name]));

            let url;
            const params = new URLSearchParams();
            // Search or discover
            if (search && search.trim() !== "" && search !== "react") {
                url = "https://api.themoviedb.org/3/search/movie";
                params.set("query", search);
                params.set("include_adult", "false");
                params.set("language", "en-US");
                params.set("page", "1");
            } else {
                url = "https://api.themoviedb.org/3/discover/movie";
                params.set("language", "en-US");
                params.set("page", "1");
                params.set("sort_by", "popularity.desc");
            }

            // Optional filters
            if (genre && genre.toLowerCase() !== "all") {
                // find genre id by name (case-insensitive)
                const wanted = normalizeGenreName(genre);
                const entry = Array.from(genreMap.entries()).find(([, name]) => String(name).toLowerCase() === String(wanted).toLowerCase());
                if (entry) params.set("with_genres", String(entry[0]));
            }
            if ((!search || search === "react") && region && region.toLowerCase() !== "all") {
                const codes = regionLabelToCountryCodes(region);
                if (codes.length > 0) params.set("with_origin_country", codes.join("|"));
            }

            const tmdbRes = await fetch(`${url}?${params.toString()}`, {
                headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
            });
            const tmdbData = await tmdbRes.json();
            const results = Array.isArray(tmdbData.results) ? tmdbData.results : [];

            let out = results.map((m) => {
                const country = (m.origin_country && m.origin_country[0]) || languageToCountry(m.original_language) || "Unknown";
                const poster = m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "";
                const backdrop = m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : poster;
                const gname = (m.genre_ids && m.genre_ids.length > 0) ? (genreMap.get(m.genre_ids[0]) || "Unknown") : "Unknown";
                return {
                    id: m.id,
                    type: "movies",
                    title: m.title || m.original_title || "Unknown Title",
                    rating: typeof m.vote_average === "number" ? Number(m.vote_average.toFixed(1)) : 0,
                    genre: gname,
                    region: countryToRegion(country),
                    country,
                    trending: Boolean(m.popularity && m.popularity > 100),
                    thumbnail: poster || backdrop,
                    description: m.overview || "",
                    language: m.original_language || undefined,
                  };
            });

            if (region && region.toLowerCase() !== "all") {
                out = out.filter((m) => m.region.toLowerCase() === region.toLowerCase());
            }
            res.status(200);
            return res.json(out);
        }

        // ========== SERIES (TMDB TV) ==========
        if (type === "series") {
            const TMDB_KEY = process.env.TMDB_API_KEY || "d3d929a444c71be2e820a0403ada5a84";
            const TMDB_TOKEN = process.env.TMDB_READ_TOKEN || "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkM2Q5MjlhNDQ0YzcxYmUyZTgyMGEwNDAzYWRhNWE4NCIsIm5iZiI6MTc2MzM5NTI2Mi43MDQsInN1YiI6IjY5MWI0NmJlNDEwZjUzNTQwY2M3Y2ZiOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.E54bicFBrnHFaRmR3W1HvR7S66cik3ShXoAYBewQOSY";

            // Fetch genre list map for TV
            const genreResp = await fetch(`https://api.themoviedb.org/3/genre/tv/list?api_key=${TMDB_KEY}&language=en-US`, {
                headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
            });
            const genreJson = await genreResp.json();
            const genreMap = new Map((genreJson.genres || []).map(g => [g.id, g.name]));

            let url;
            const params = new URLSearchParams();
            if (search && search.trim() !== "" && search !== "react") {
                url = "https://api.themoviedb.org/3/search/tv";
                params.set("query", search);
                params.set("include_adult", "false");
                params.set("language", "en-US");
                params.set("page", "1");
            } else {
                url = "https://api.themoviedb.org/3/discover/tv";
                params.set("language", "en-US");
                params.set("page", "1");
                params.set("sort_by", "popularity.desc");
            }

            if (genre && genre.toLowerCase() !== "all") {
                const wanted = normalizeGenreName(genre);
                const entry = Array.from(genreMap.entries()).find(([, name]) => String(name).toLowerCase() === String(wanted).toLowerCase());
                if (entry) params.set("with_genres", String(entry[0]));
            }
            if ((!search || search === "react") && region && region.toLowerCase() !== "all") {
                const codes = regionLabelToCountryCodes(region);
                if (codes.length > 0) params.set("with_origin_country", codes.join("|"));
            }

            const tmdbRes = await fetch(`${url}?${params.toString()}`, {
                headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
            });
            const tmdbData = await tmdbRes.json();
            const results = Array.isArray(tmdbData.results) ? tmdbData.results : [];

            let out = results.map((t) => {
                const country = (t.origin_country && t.origin_country[0]) || languageToCountry(t.original_language) || "Unknown";
                const poster = t.poster_path ? `https://image.tmdb.org/t/p/w500${t.poster_path}` : "";
                const backdrop = t.backdrop_path ? `https://image.tmdb.org/t/p/w780${t.backdrop_path}` : poster;
                const gname = (t.genre_ids && t.genre_ids.length > 0) ? (genreMap.get(t.genre_ids[0]) || "Unknown") : "Unknown";
                return {
                    id: t.id,
                    type: "series",
                    title: t.name || t.original_name || "Unknown Title",
                    rating: typeof t.vote_average === "number" ? Number(t.vote_average.toFixed(1)) : 0,
                    genre: gname,
                    region: countryToRegion(country),
                    country,
                    trending: Boolean(t.popularity && t.popularity > 100),
                    thumbnail: poster || backdrop,
                    description: t.overview || "",
                    language: t.original_language || undefined,
                  };
            });

            if (region && region.toLowerCase() !== "all") {
                out = out.filter((m) => m.region.toLowerCase() === region.toLowerCase());
            }
            res.status(200);
            return res.json(out);
        }

        // ========== ALL (aggregate) ==========
        if (type === "all") {
            const [mv, tv, bk, gm, mu] = await Promise.all([
                _moviesFromTMDB(search, genre, region).catch(() => []),
                _seriesFromTMDB(search, genre, region).catch(() => []),
                _booksFromGoogle(search, genre, region).catch(() => []),
                _animeFromTMDB(search, genre, region).catch(() => []),
                _musicFromSpotify(search).catch(() => []),
            ]);
            const combined = [...mv, ...tv, ...bk, ...gm, ...mu];
            res.status(200);
            return res.json(combined);
        }

        // ========== ANIME ==========
        if (type === "anime") {
            const out = await _animeFromTMDB(search, genre, region).catch(() => []);
            res.status(200);
            return res.json(out);
        }

        if (type === "music") {
            try {
                const token = await getSpotifyToken();
                if(search && search === "react") search = "Alan walker"; // fallback artist
                const key = `music:${search || ''}`;
                const cached = getCache(key);
                if (cached) { res.status(200); return res.json(cached); }

                let url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(search)}&type=track&limit=20`;

                // Call Spotify API with timeout
                const source = axios.CancelToken.source();
                const timer = setTimeout(() => source.cancel("timeout"), 8000);
                const response = await axios.get(url, {
                    headers: { Authorization: `Bearer ${token}` },
                    cancelToken: source.token,
                }).finally(() => clearTimeout(timer));
                const tracksArray = response.data?.tracks?.items || [];

                let filteredMusic = tracksArray.map(track => {
                    const album = track.album;
                    const artistNames = track.artists.map(a => a.name);

                    return {
                        id: track.id,
                        type: "music",
                        title: track.name,
                        artists: artistNames,
                        album: album.name,
                        release_date: album.release_date,
                        thumbnail: album.images[0]?.url || "",
                        preview_url: track.preview_url, // 30s preview if available
                        spotifyUrl: track.external_urls.spotify,
                        popularity: track.popularity
                    };
                });

                // (optional) filter by genre — Spotify doesn’t give genre per track directly,
                // only at the artist level. You’d need to fetch artist genre if you want this.

                setCache(key, filteredMusic);
                res.status(200);
                return res.json(filteredMusic);
            } catch (error) {
                console.error(error);
                res.status(500);
                return res.json({ error: error.message });
            }
        }


        // ========== FALLBACK ==========
        res.status(400)
        return res.json({ error: "Invalid or unsupported type" });
    } catch (error) {
        console.error(error);
        res.status(500)
        return res.json({ error: error.message });
    }
});

// Public reviews for an item aggregated across user profiles
router.get("/reviews", async (req, res) => {
    try {
        const { externalId, url, name, type } = req.query;

        if (!externalId && !url && !(name && type)) {
            res.status(400);
            return res.json({ msg: "Provide externalId, or url, or name+type to fetch reviews." });
        }

        const orConds = [];
        if (externalId) orConds.push({ externalId: String(externalId) });
        if (url) orConds.push({ url: String(url) });
        if (name && type) {
            // case-insensitive name match and exact type
            const safe = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            orConds.push({ name: { $regex: new RegExp(`^${safe}$`, "i") }, type: String(type) });
        }

        // find profiles with at least one matching list item having a non-empty review
        const profiles = await Profile.find({
            lists: {
                $elemMatch: {
                    review: { $exists: true, $ne: "" },
                    $or: orConds,
                },
            },
        }).populate({ path: "userId", select: "username name verified" });

        const reviews = [];
        for (const p of profiles) {
            const user = p.userId;
            // Optionally include only verified users' comments
            if (!user || user.verified === false) continue;
            for (const li of p.lists || []) {
                if (!li.review || li.review === "") continue;
                const matches = (
                    (externalId && li.externalId && String(li.externalId) === String(externalId)) ||
                    (url && li.url && String(li.url) === String(url)) ||
                    ((name && type) && li.name && li.type &&
                        String(li.type) === String(type) &&
                        String(li.name).toLowerCase() === String(name).toLowerCase())
                );
                if (!matches) continue;
                reviews.push({
                    user: {
                        id: user._id,
                        username: user.username,
                        name: user.name,
                    },
                    avatarUrl: p.avatarUrl || "",
                    rating: typeof li.rating === "number" ? li.rating : 0,
                    review: li.review,
                    rewatchCount: li.rewatchCount || 0,
                    status: li.status || "currently_watching",
                    type: li.type || "unknown",
                    name: li.name,
                });
            }
        }

        // sort by rating desc then by username
        reviews.sort((a, b) => (b.rating || 0) - (a.rating || 0) || String(a.user.username || "").localeCompare(String(b.user.username || "")));

        res.status(200);
        return res.json({ count: reviews.length, reviews });
    } catch (err) {
        console.error(err);
        res.status(500);
        return res.json({ msg: "Failed to fetch reviews", error: err.message });
    }
});

// AI-powered mood recommendations (heuristic + personalization)
router.get("/recommendations", async (req, res) => {
    try {
        let { mood = "chill", types = "all", limit = 24, userId, q } = req.query;
        mood = String(mood).toLowerCase();
        limit = Math.max(1, Math.min(100, parseInt(limit, 10) || 24));

        const typeList = (types && types !== 'all')
            ? String(types).split(',').map(t => t.trim()).filter(Boolean)
            : ["movies","series","books","anime","music"];

        // Map moods to genres/queries per type
        const moodMap = {
            chill: {
                movies: { genre: "Drama" },
                series: { genre: "Drama" },
                books: { search: "contemporary fiction" },
                anime: { genre: "Animation" },
                music: { search: "lofi chill" },
            },
            excited: {
                movies: { genre: "Action" },
                series: { genre: "Action" },
                books: { search: "action thriller" },
                anime: { genre: "Animation" },
                music: { search: "energetic workout" },
            },
            romantic: {
                movies: { genre: "Romance" },
                series: { genre: "Romance" },
                books: { search: "romance novel" },
                anime: { genre: "Animation" },
                music: { search: "romantic ballad" },
            },
            dark: {
                movies: { genre: "Thriller" },
                series: { genre: "Thriller" },
                books: { search: "dark mystery" },
                anime: { genre: "Animation" },
                music: { search: "dark ambient" },
            },
            inspirational: {
                movies: { genre: "Documentary" },
                series: { genre: "Documentary" },
                books: { search: "self help motivational" },
                anime: { genre: "Animation" },
                music: { search: "uplifting instrumental" },
            },
            funny: {
                movies: { genre: "Comedy" },
                series: { genre: "Comedy" },
                books: { search: "humor satire" },
                anime: { genre: "Animation" },
                music: { search: "feel good pop" },
            },
            nostalgic: {
                movies: { genre: "Family" },
                series: { genre: "Family" },
                books: { search: "classic literature" },
                anime: { genre: "Animation" },
                music: { search: "80s hits" },
            },
            focus: {
                movies: { genre: "Documentary" },
                series: { genre: "Documentary" },
                books: { search: "nonfiction science" },
                anime: { genre: "Animation" },
                music: { search: "lofi beats to study" },
            },
        };
        const profile = moodMap[mood] || moodMap.chill;

        // Personalization: exclude items already in user's list (if provided)
        let ownedExternal = new Set();
        let ownedKey = new Set();
        if (userId) {
            try {
                const me = await Profile.findOne({ userId }).lean();
                if (me && Array.isArray(me.lists)) {
                    for (const li of me.lists) {
                        if (li.externalId) ownedExternal.add(String(li.externalId));
                        const key = `${(li.name||'').toLowerCase()}|${(li.type||'unknown').toLowerCase()}`;
                        ownedKey.add(key);
                    }
                }
            } catch (_) {}
        }

        const tasks = [];
        const addTask = (fn) => tasks.push(fn);

        const seed = (fallback) => (q && String(q).trim().length >= 3) ? String(q) : fallback;

        if (typeList.includes('movies')) addTask(async () => _moviesFromTMDB('', profile.movies?.genre || 'all', 'all'));
        if (typeList.includes('series')) addTask(async () => _seriesFromTMDB('', profile.series?.genre || 'all', 'all'));
        if (typeList.includes('books')) addTask(async () => _booksFromGoogle(seed(profile.books?.search || mood), 'all', 'all'));
        if (typeList.includes('anime')) addTask(async () => _animeFromTMDB('', profile.anime?.genre || 'all', 'all'));
        if (typeList.includes('music')) addTask(async () => _musicFromSpotify(seed(profile.music?.search || mood)));

        const results = await Promise.all(tasks.map(t => t().catch(() => [])));
        let combined = results.flat();

        // Filter out owned
        combined = combined.filter(it => {
            if (it.externalId && ownedExternal.has(String(it.externalId))) return false;
            const key = `${(it.title||'').toLowerCase()}|${(it.type||'unknown').toLowerCase()}`;
            if (ownedKey.has(key)) return false;
            return true;
        });

        // Score and sort (rating/popularity)
        const score = (it) => {
            if (typeof it.rating === 'number' && it.rating > 0) return it.rating;
            if (typeof it.popularity === 'number') return it.popularity / 10;
            return 0;
        };
        combined.sort((a,b) => score(b) - score(a));

        // Limit overall, but keep a balanced mix if possible
        const max = limit;
        const slice = combined.slice(0, max);

        res.status(200);
        return res.json(slice);
    } catch (err) {
        console.error(err);
        res.status(500);
        return res.json({ msg: "Failed to generate recommendations", error: err.message });
    }
});

export default router;
