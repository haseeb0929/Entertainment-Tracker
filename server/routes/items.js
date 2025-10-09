import axios from "axios";
import express from "express";
import getSpotifyToken from "../utils/spotify.js";
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

router.get("/items", async (req, res) => {
    let { search, type, genre, region } = req.query;
    if (!search || search.trim() === "") {
        search = "react"; // default fallback
    }

    try {
        // ========== BOOKS ==========
        if (type === "books") {
            const response = await axios.get(
                `https://www.googleapis.com/books/v1/volumes?q=${search}&maxResults=40&key=AIzaSyAfE1xHB3BtljtR3r-WN2bg9siQpH64B48`
            );

            let filteredBooks = (response.data.items || []).map((item) => {
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
            res.status(200);
            return res.json(filteredBooks);
        }

        // ========== MOVIES ==========
        if (type === "movies") {
            let url;
            let flag = true;
            if (search && search.trim() !== "" && search !== "react") {
                if (genre && genre.toLowerCase() !== "all") {
                    url = `https://imdb236.p.rapidapi.com/api/imdb/search?type=movie&originalTitle=${search}&genre=${genre}&rows=25&sortOrder=ASC&sortField=id`;
                } else {
                    url = `https://imdb236.p.rapidapi.com/api/imdb/search?type=movie&originalTitle=${search}&rows=25&sortOrder=ASC&sortField=id`;
                }
            } else {
                url = "https://imdb236.p.rapidapi.com/api/imdb/cast/nm0000190/titles"; // fallback
            }

            const options = {
                method: "GET",
                headers: {
                    "x-rapidapi-key": "53744574b1msh746951879fe4261p191de7jsn3f3f40ebfad8",
                    "x-rapidapi-host": "imdb236.p.rapidapi.com",
                },
            };

            const response = await fetch(url, options);
            const data = await response.json();

            const moviesArray = Array.isArray(data.results)
                ? data.results
                : Array.isArray(data)
                    ? data
                    : [];

            let filteredMovies = moviesArray.map((item) => {
                const country =
                    (item.countriesOfOrigin && item.countriesOfOrigin[0]) || "Unknown";
                return {
                    id: item.id,
                    type: "movies",
                    title: item.primaryTitle || item.originalTitle || "Unknown Title",
                    rating: item.averageRating || 0,
                    genre: item.genres?.[0] || "Unknown",
                    region: countryToRegion(country),
                    country,
                    trending: false,
                    thumbnail: item.primaryImage || "",
                    description: item.description || "",
                };
            });

            if (genre && genre.toLowerCase() !== "all") {
                filteredMovies = filteredMovies.filter(
                    (m) => m.genre.toLowerCase() === genre.toLowerCase()
                );
            }
            if (region && region.toLowerCase() !== "all") {
                filteredMovies = filteredMovies.filter(
                    (m) => m.region.toLowerCase() === region.toLowerCase()
                );
            }
            res.status(200)
            return res.json(filteredMovies);
        }

        // ========== GAMES ==========
        if (type === "games") {
            const apiKey = "decd56d444eb4de18699c2f950138a5b";
            let url = `https://api.rawg.io/api/games?key=${apiKey}&page_size=100`;

            if (search && search.trim() !== "" && search !== "react") {
                url += `&search=${encodeURIComponent(search)}`;
            }
            if (genre && genre.toLowerCase() !== "all") {
                url += `&genre=${encodeURIComponent(genre)}`;
            }

            const response = await fetch(url);
            const data = await response.json();
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

            res.status(200)
            return res.json(filteredGames);
        }

        if (type === "music") {
            try {
                const token = await getSpotifyToken();
                if(search && search === "react") search = "Alan walker"; // fallback artist

                let url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(search)}&type=track&limit=20`;

                // Call Spotify API
                const response = await axios.get(url, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log(response.data.tracks);
                const tracksArray = response.data.tracks?.items || [];

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

export default router;
