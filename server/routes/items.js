import axios from "axios";
import express from "express";
import getSpotifyToken from "../utils/spotify.js";
import Profile from "../models/Profile.js";
import User from "../models/User.js";
const router = express.Router();

// 🔹 Country → Region mapper
const countryToRegion = (countryCode) => {
    if (!countryCode) return "Unknown";
    const regions = {
        US: "Hollywood",
        CA: "Hollywood",
        MX: "Hollywood",
        GB: "European",
        FR: "European",
        DE: "European",
        IT: "European",
        ES: "European",
        IN: "Asian",
        PK: "Asian",
        CN: "Asian",
        JP: "Asian",
        BR: "Hollywood",
        AR: "Hollywood",
        CL: "Hollywood",
        NG: "Africa",
        ZA: "Africa",
        EG: "Africa",
        AU: "Oceania",
        NZ: "Oceania",
    };
    return regions[countryCode] || "Other";
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
        const entry = Array.from(genreMap.entries()).find(([, name]) => String(name).toLowerCase() === String(genre).toLowerCase());
        if (entry) params.set("with_genres", String(entry[0]));
    }
    const tmdbRes = await fetch(`${url}?${params.toString()}`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
    const tmdbData = await tmdbRes.json();
    const results = Array.isArray(tmdbData.results) ? tmdbData.results : [];
    let out = results.map((m) => {
        const country = (m.origin_country && m.origin_country[0]) || "Unknown";
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
        const entry = Array.from(genreMap.entries()).find(([, name]) => String(name).toLowerCase() === String(genre).toLowerCase());
        if (entry) params.set("with_genres", String(entry[0]));
    }
    const tmdbRes = await fetch(`${url}?${params.toString()}`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
    const tmdbData = await tmdbRes.json();
    const results = Array.isArray(tmdbData.results) ? tmdbData.results : [];
    let out = results.map((t) => {
        const country = (t.origin_country && t.origin_country[0]) || "Unknown";
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

async function _gamesFromRawg(search, genre) {
    const apiKey = "decd56d444eb4de18699c2f950138a5b";
    const key = `games:${search || ''}:${genre || 'all'}`;
    const cached = getCache(key);
    if (cached) return cached;
    let url = `https://api.rawg.io/api/games?key=${apiKey}&page_size=40`;
    if (search && search.trim() !== "" && search !== "react") url += `&search=${encodeURIComponent(search)}`;
    if (genre && genre.toLowerCase() !== "all") url += `&genre=${encodeURIComponent(genre)}`;
    const data = await fetchJsonWithRetry(url, {}, { retries: 1, timeoutMs: 8000 });
    let out = (data.results || []).map((item) => ({
        id: item.id,
        type: "games",
        title: item.name || "Unknown Title",
        rating: item.rating || 0,
        genre: item.genres?.[0]?.name || "Unknown",
        region: "Global",
        country: "Unknown",
        trending: false,
        thumbnail: item.background_image || "",
        description: item.description || "",
        released: item.released || "",
        platforms: item.platforms ? item.platforms.map((p) => p.platform.name) : [],
        esrb: item.esrb_rating?.name || "Not Rated",
    }));
    if (genre && genre.toLowerCase() !== "all") out = out.filter((g) => (g.genre || '').toLowerCase() === genre.toLowerCase());
    setCache(key, out);
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
                const entry = Array.from(genreMap.entries()).find(([, name]) => String(name).toLowerCase() === String(genre).toLowerCase());
                if (entry) params.set("with_genres", String(entry[0]));
            }

            const tmdbRes = await fetch(`${url}?${params.toString()}`, {
                headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
            });
            const tmdbData = await tmdbRes.json();
            const results = Array.isArray(tmdbData.results) ? tmdbData.results : [];

            let out = results.map((m) => {
                const country = (m.origin_country && m.origin_country[0]) || "Unknown";
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
                const entry = Array.from(genreMap.entries()).find(([, name]) => String(name).toLowerCase() === String(genre).toLowerCase());
                if (entry) params.set("with_genres", String(entry[0]));
            }

            const tmdbRes = await fetch(`${url}?${params.toString()}`, {
                headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
            });
            const tmdbData = await tmdbRes.json();
            const results = Array.isArray(tmdbData.results) ? tmdbData.results : [];

            let out = results.map((t) => {
                const country = (t.origin_country && t.origin_country[0]) || "Unknown";
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
                _gamesFromRawg(search, genre).catch(() => []),
                _musicFromSpotify(search).catch(() => []),
            ]);
            const combined = [...mv, ...tv, ...bk, ...gm, ...mu];
            res.status(200);
            return res.json(combined);
        }

        // ========== GAMES ==========
        if (type === "games") {
            const apiKey = "decd56d444eb4de18699c2f950138a5b";
            const key = `games:${search || ''}:${genre || 'all'}`;
            const cached = getCache(key);
            if (cached) { res.status(200); return res.json(cached); }
            let url = `https://api.rawg.io/api/games?key=${apiKey}&page_size=40`;

            if (search && search.trim() !== "" && search !== "react") {
                url += `&search=${encodeURIComponent(search)}`;
            }
            if (genre && genre.toLowerCase() !== "all") {
                url += `&genre=${encodeURIComponent(genre)}`;
            }

            const data = await fetchJsonWithRetry(url, {}, { retries: 1, timeoutMs: 8000 });
            let filteredGames = (data.results || []).map((item) => ({
                id: item.id,
                type: "games",
                title: item.name || "Unknown Title",
                rating: item.rating || 0,
                genre: item.genres?.[0]?.name || "Unknown",
                region: "Global", // RAWG does not provide region
                country: "Unknown",
                trending: false,
                thumbnail: item.background_image || "",
                description: item.description || "",
                released: item.released || "",
                platforms: item.platforms
                    ? item.platforms.map((p) => p.platform.name)
                    : [],
                esrb: item.esrb_rating?.name || "Not Rated",
            }));

            if (genre && genre.toLowerCase() !== "all") {
                filteredGames = filteredGames.filter(
                    (g) => g.genre.toLowerCase() === genre.toLowerCase()
                );
            }

            setCache(key, filteredGames);
            res.status(200)
            return res.json(filteredGames);
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
            : ["movies","series","books","games","music"];

        // Map moods to genres/queries per type
        const moodMap = {
            chill: {
                movies: { genre: "Drama" },
                series: { genre: "Drama" },
                books: { search: "contemporary fiction" },
                games: { genre: "Indie" },
                music: { search: "lofi chill" },
            },
            excited: {
                movies: { genre: "Action" },
                series: { genre: "Action" },
                books: { search: "action thriller" },
                games: { genre: "Action" },
                music: { search: "energetic workout" },
            },
            romantic: {
                movies: { genre: "Romance" },
                series: { genre: "Romance" },
                books: { search: "romance novel" },
                games: { genre: "Casual" },
                music: { search: "romantic ballad" },
            },
            dark: {
                movies: { genre: "Thriller" },
                series: { genre: "Thriller" },
                books: { search: "dark mystery" },
                games: { genre: "Horror" },
                music: { search: "dark ambient" },
            },
            inspirational: {
                movies: { genre: "Documentary" },
                series: { genre: "Documentary" },
                books: { search: "self help motivational" },
                games: { genre: "Adventure" },
                music: { search: "uplifting instrumental" },
            },
            funny: {
                movies: { genre: "Comedy" },
                series: { genre: "Comedy" },
                books: { search: "humor satire" },
                games: { genre: "Casual" },
                music: { search: "feel good pop" },
            },
            nostalgic: {
                movies: { genre: "Family" },
                series: { genre: "Family" },
                books: { search: "classic literature" },
                games: { genre: "Puzzle" },
                music: { search: "80s hits" },
            },
            focus: {
                movies: { genre: "Documentary" },
                series: { genre: "Documentary" },
                books: { search: "nonfiction science" },
                games: { genre: "Strategy" },
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
        if (typeList.includes('games')) addTask(async () => _gamesFromRawg('', profile.games?.genre || 'all'));
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
