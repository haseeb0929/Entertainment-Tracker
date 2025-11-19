import { useState, useEffect, useRef } from "react"  // ✅ Added useRef
import {
  Search, Filter, Star, TrendingUp, Heart, Play, Book,
  Music, Tv, Film, Home, User, LogIn,
  Info, AlertCircle,
} from "lucide-react"
import { Navigation } from "../lib/Navigation"
import { Card } from "../lib/Card"
import { CardContent } from "../lib/CardContent"
import { Input } from "../lib/Input"
import { Button } from "../lib/Button"
import { MenuSelect } from "../lib/MenuSelect"
import { Badge } from "../lib/Badge"
import { useAuth } from "../utils/AuthContext"

const entertainmentTypes = [
  { id: "movies", name: "Movies", icon: Film, color: "from-red-500 to-pink-500" },
  { id: "series", name: "TV Series", icon: Tv, color: "from-blue-500 to-purple-500" },
  { id: "music", name: "Music", icon: Music, color: "from-green-500 to-teal-500" },
  { id: "books", name: "Books", icon: Book, color: "from-yellow-500 to-orange-500" },
  { id: "anime", name: "Anime", icon: Tv, color: "from-fuchsia-500 to-pink-500" },
]

const genres = ["Action", "Comedy", "Drama", "Horror", "Romance", "Sci-Fi", "Thriller", "Documentary"]
const regions = ["Hollywood", "Bollywood", "Korean", "Japanese", "British", "European", "Asian"]
// Static book categories provided
const BOOK_CATEGORIES = [
  "Agricultural experiment stations",
  "Agriculture",
  "American fiction",
  "American literature",
  "Art",
  "Authors, American",
  "Bakers",
  "Bibles",
  "Biography & Autobiography",
  "Books",
  "Booksellers' catalogs",
  "Business",
  "Business & Economics",
  "Chemistry",
  "Chemistry, Technical",
  "Children",
  "Christianity",
  "Civil engineering",
  "Computers",
  "Diagnosis",
  "Disasters",
  "Education",
  "Educational technology",
  "Electrical engineering",
  "English fiction",
  "Fiction",
  "French drama",
  "German fiction",
  "High schools",
  "History",
  "Horror fiction",
  "Horror films",
  "Humor",
  "Iowa",
  "Italy",
  "Juvenile Fiction",
  "Juvenile Nonfiction",
  "Language Arts & Disciplines",
  "Libraries",
  "Literary Criticism",
  "Murder",
  "Performing Arts",
  "Philosophy",
  "Physical education and training",
  "Psychology",
  "Reference",
  "Romances, English",
  "Science",
  "Social Science",
  "Subject headings, Library of Congress",
  "Technology",
  "Technology & Engineering",
  "Travel",
  "Universities and colleges"
];

const HomePage = ({ navigateToPage = () => { } }) => {
  const { auth } = useAuth();

  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [popup, setPopup] = useState(null);

  const [selectedType, setSelectedType] = useState("all")
  const [selectedGenre, setSelectedGenre] = useState("all")
  const [selectedRegion, setSelectedRegion] = useState("all")
  const [selectedMood, setSelectedMood] = useState("none")
  const [selectedBookCategory, setSelectedBookCategory] = useState("all")

  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // ✅ Timeout ref for cleanup
  const popupTimeoutRef = useRef(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery.length === 0 || searchQuery.length >= 3) {
        setDebouncedSearch(searchQuery)
      }
    }, 400)
    return () => clearTimeout(handler)
  }, [searchQuery])

  const queryObj = {
    search: debouncedSearch || "",
    type: selectedType || "all",
    region: selectedRegion || "all",
  };
  if (selectedType === 'books') {
    if (selectedBookCategory && selectedBookCategory !== 'all') {
      queryObj.categories = selectedBookCategory;
    }
  } else {
    queryObj.genre = selectedGenre || 'all';
  }
  const query = new URLSearchParams(queryObj).toString()

  // Reset incompatible filters on type change
  useEffect(() => {
    if (selectedType === 'books') {
      if (selectedGenre !== 'all') setSelectedGenre('all');
    } else {
      if (selectedBookCategory !== 'all') setSelectedBookCategory('all');
    }
  }, [selectedType])

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      setError(null);
      const url = selectedMood && selectedMood !== 'none'
        ? (() => {
            const p = new URLSearchParams();
            p.set('mood', selectedMood);
            p.set('types', selectedType || 'all');
            p.set('limit', '28');
            if (debouncedSearch && debouncedSearch.length >= 3) p.set('q', debouncedSearch);
            return `http://localhost:5000/getItemsOf/recommendations?${p.toString()}`;
          })()
        : `http://localhost:5000/getItemsOf/items?${query}`;
      for (let attempt = 0; attempt < 2; attempt++) {
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
          const res = await fetch(url, { method: "GET", signal: controller.signal });
          clearTimeout(timeout);
          if (!res.ok) throw new Error(`Request failed: ${res.status}`);
          const data = await res.json();
          if (!mounted) return;
          setItems(Array.isArray(data) ? data : []);
          setIsLoading(false);
          return; // success
        } catch (err) {
          clearTimeout(timeout);
          if (attempt === 1) {
            if (!mounted) return;
            setError("Failed to load content");
            setItems([]);
            setIsLoading(false);
          } else {
            // brief backoff before retry
            await new Promise((r) => setTimeout(r, 400));
          }
        }
      }
    };
    load();
    return () => { mounted = false; controller.abort(); };
  }, [query, selectedMood, debouncedSearch, selectedType])

  // ✅ Improved handler with logging, fallbacks, and unified popup
  const handleAddToList = async (item) => {
    console.log('🔥 Heart clicked for item:', item);  // Debug: Confirm click
    console.log('Auth status:', auth);  // Debug: Check auth

    if (!auth || !auth.user) {
      // ✅ Use popup for consistency (instead of banner)
      setPopup({
        message: "Sign in to save your favorite entertainment! 👋",
        type: "error"
      });
      showPopupWithTimeout();
      return;
    }

    // ✅ Fallback if url missing (adjust based on your data; e.g., use thumbnail or generate)
    const itemUrl = item.url || item.thumbnail || `https://example.com/${item.title.replace(/\s+/g, '-')}`;  // Placeholder fallback

    try {
      console.log('📤 Sending to backend:', { id: auth.user._id, item: { url: itemUrl, name: item.title, status: "unwatched" } });  // Debug

      const res = await fetch(`http://localhost:5000/api/profile/saveItem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
        },
        body: JSON.stringify({
          userId: auth.user.id,
          item: {
            url: itemUrl,
            name: item.title,
            description: item.description || "",
            status: "currently_watching",
            type: item.type || "unknown",
            thumbnail: item.thumbnail || "",
            externalId: item.id || undefined,
          },
        }),
      });

      const data = await res.json();
      console.log('📥 Backend response:', data);  // Debug

      if (!res.ok) throw new Error(data.msg || "Failed to add item");

      if (data.duplicate) {
        setPopup({ message: `"${item.title}" is already in your list.`, type: "error" });
        showPopupWithTimeout();
        return;
      }

      // ✅ Success popup
      setPopup({ message: `"${item.title}" added to your list! ❤️`, type: "success" });
      showPopupWithTimeout();
    } catch (err) {
      console.error('❌ Add to list error:', err);  // Debug
      setPopup({ message: err.message || "Failed to add item. Try again!", type: "error" });
      showPopupWithTimeout();
    }
  };

  // ✅ Helper to show popup and auto-hide (with cleanup)
  const showPopupWithTimeout = () => {
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    popupTimeoutRef.current = setTimeout(() => setPopup(null), 3000);
  };

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navigation currentPage="home" navigateToPage={navigateToPage} />

      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"
          style={{ animationDelay: "4s" }}
        ></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 pt-24 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            Entertainment Hub
          </h1>
          <p className="text-xl text-gray-300">Discover, Track, and Share Your Entertainment Journey</p>
        </header>

        {/* Optional Error Banner (keep for loading errors, but use popup for actions) */}
        {error && typeof error !== 'object' && (
          <div className="max-w-4xl mx-auto mb-6">
            <Card>
              <CardContent>
                <p className="text-red-300">{error}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ✅ Improved Floating Popup Notification - Higher z, better visibility */}
        {popup && (
          <div
            className={`fixed bottom-6 right-6 z-[100] transform transition-all duration-500 ease-out animate-fade-in 
              ${popup.type === "success" 
                ? "bg-gradient-to-r from-purple-500 to-pink-500 border border-purple-400/50 shadow-2xl shadow-purple-500/25" 
                : "bg-red-600 border border-red-400/50 shadow-2xl shadow-red-500/25"} 
              text-white rounded-xl px-6 py-4 flex items-center gap-3 max-w-sm`}
            role="alert"  // Accessibility
          >
            {popup.type === "success" ? (
              <Heart className="w-5 h-5 text-white animate-pulse" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-300" />
            )}
            <span className="text-sm font-medium flex-1">{popup.message}</span>
            <button
              onClick={() => setPopup(null)}
              className="ml-2 text-white/70 hover:text-white"
            >
              ×
            </button>  {/* Close button for manual dismiss */}
          </div>
        )}

        {/* Search and Filter Section */}
        <div className="max-w-4xl mx-auto mb-12">
          <Card className="relative z-[100]">
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Search movies, series, music, books, anime..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    icon={<Search className="w-5 h-5" />}
                  />
                </div>
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MenuSelect
                  value={selectedType}
                  onValueChange={setSelectedType}
                  placeholder="Type"
                  options={[
                    { value: 'all', label: 'All Types' },
                    ...entertainmentTypes.map(t => ({ value: t.id, label: t.name }))
                  ]}
                />

                {selectedType === 'books' ? (
                  <MenuSelect
                    value={selectedBookCategory}
                    onValueChange={setSelectedBookCategory}
                    placeholder="Book Category"
                    options={[{ value: 'all', label: 'All Categories' }, ...BOOK_CATEGORIES.map(c => ({ value: c, label: c }))]}
                  />
                ) : (
                  <MenuSelect
                    value={selectedGenre}
                    onValueChange={setSelectedGenre}
                    placeholder="Genre"
                    options={[
                      { value: 'all', label: 'All Genres' },
                      ...genres.map(g => ({ value: g, label: g }))
                    ]}
                  />
                )}

                <MenuSelect
                  value={selectedRegion}
                  onValueChange={setSelectedRegion}
                  placeholder="Region"
                  options={[
                    { value: 'all', label: 'All Regions' },
                    ...regions.map(r => ({ value: r, label: r }))
                  ]}
                />

                <MenuSelect
                  value={selectedMood}
                  onValueChange={setSelectedMood}
                  placeholder="Mood"
                  options={[
                    { value: 'none', label: 'No Mood' },
                    { value: 'chill', label: 'Chill' },
                    { value: 'excited', label: 'Excited' },
                    { value: 'romantic', label: 'Romantic' },
                    { value: 'dark', label: 'Dark' },
                    { value: 'inspirational', label: 'Inspirational' },
                    { value: 'funny', label: 'Funny' },
                    { value: 'nostalgic', label: 'Nostalgic' },
                    { value: 'focus', label: 'Focus' },
                  ]}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Entertainment Type Tabs */}
        <div className="mb-12">
          <div className="grid grid-cols-6 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg p-1">
            <button
              onClick={() => setSelectedType("all")}
              className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${selectedType === "all" ? "bg-white/20 text-white" : "text-white/70 hover:text-white"
                }`}
            >
              All
            </button>
            {entertainmentTypes.map((type) => {
              const Icon = type.icon;  // ✅ Fix: Extract Icon properly
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${selectedType === type.id ? "bg-white/20 text-white" : "text-white/70 hover:text-white"
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {type.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
              <Card key={index} className="animate-pulse h-80 bg-gray-800 rounded-lg">
                <CardContent className="p-4">
                  <div className="w-full h-48 bg-white/20 rounded-lg mb-4"></div>
                  <div className="h-6 bg-white/20 rounded mb-2"></div>
                  <div className="h-4 bg-white/20 rounded mb-4"></div>
                  <div className="h-4 bg-white/20 rounded w-3/4"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((item, index) => {
              const typeInfo = entertainmentTypes.find((t) => t.id === item.type)
              const Icon = typeInfo?.icon || Film

              return (
                <Card
                  key={item.id || `${item.title}-${index}`}
                  className="group relative overflow-hidden h-96 hover:border-purple-400 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/25 rounded-lg"
                  style={{
                    animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`,
                  }}
                >
                  {/* Thumbnail as <img> */}
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail
                        ?.replace("http://", "https://")
                        .replace("zoom=1", "zoom=3")}
                      alt={item.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gray-800">
                      <Film className="w-16 h-16 text-gray-500 mb-2" />
                      <span className="text-gray-400 text-sm font-semibold">Thumbnail Not Available</span>
                    </div>
                  )}

                  {/* Dark overlay for readability */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300"></div>

                  {/* Subtle type color tint */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${typeInfo?.color || "from-gray-500 to-gray-500"
                      } opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                  ></div>

                  {/* Your overlayed card content */}
                  <CardContent className="relative z-10 p-4 flex flex-col justify-between h-full opacity-0 group-hover:opacity-100 transition-all duration-300">
                    {/* Top: Icon and Trending Badge */}
                    <div className="flex items-start justify-between">
                      <div
                        className={`p-2 rounded-lg bg-gradient-to-br ${typeInfo?.color || "from-gray-500 to-gray-500"
                          } bg-opacity-80`}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      {item.trending && (
                        <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white bg-opacity-90">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                    </div>

                    {/* Middle: Title and Rating */}
                    <div className="flex flex-col flex-1 justify-end">
                      <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                      <div className="flex items-center gap-2 mb-3">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-white font-semibold">{(item.rating ? item.rating : item.popularity) || 0}</span>
                        <span className="text-gray-300">(
                          {Array.isArray(item.genres) && item.genres.length > 0
                            ? item.genres.join(', ')
                            : Array.isArray(item.categories) && item.categories.length > 0
                              ? item.categories.join(', ')
                              : item.genre}
                        )</span>
                      </div>
                    </div>

                    {/* Bottom: Region Badge and Action Buttons */}
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                        {item.region}
                      </Badge>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-white hover:text-purple-300 hover:bg-white/20"
                          onClick={() => handleAddToList(item)}
                        >
                          <Heart className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-white hover:text-purple-300 hover:bg-white/20"
                          onClick={() => navigateToPage("itemDetailsPage", { item })}
                        >
                          <Info className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

                {/* Empty State */}
        {!isLoading && items.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-6 bg-white/10 rounded-full flex items-center justify-center">
              <Search className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">No content found</h3>
            <p className="text-gray-400">Try adjusting your filters or search query</p>
          </div>
        )}
      </div>

      <style>{`
        /* ✨ Smooth "pop-up" fade-in animation */
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.5s ease-out both;
        }

        /* ✨ Upward fade for elements entering the view (like cards or sections) */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out both;
        }
      `}</style>
    </div>
  )
}

export default HomePage