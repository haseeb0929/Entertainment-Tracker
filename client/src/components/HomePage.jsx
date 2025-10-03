import { useState, useEffect } from "react"
import {
  Search, Filter, Star, TrendingUp, Heart, Play, Book,
  Music, Gamepad2, Tv, Film, Home, User, LogIn,
} from "lucide-react"
import { Navigation } from "../lib/Navigation"
import { Card } from "../lib/Card"
import { CardContent } from "../lib/CardContent"
import { Input } from "../lib/Input"
import { Button } from "../lib/Button"
import { Select } from "../lib/Select"
import { Badge } from "../lib/Badge"

const entertainmentTypes = [
  { id: "movies", name: "Movies", icon: Film, color: "from-red-500 to-pink-500" },
  { id: "series", name: "TV Series", icon: Tv, color: "from-blue-500 to-purple-500" },
  { id: "music", name: "Music", icon: Music, color: "from-green-500 to-teal-500" },
  { id: "books", name: "Books", icon: Book, color: "from-yellow-500 to-orange-500" },
  { id: "games", name: "Games", icon: Gamepad2, color: "from-purple-500 to-indigo-500" },
]

const genres = ["Action", "Comedy", "Drama", "Horror", "Romance", "Sci-Fi", "Thriller", "Documentary"]
const regions = ["Hollywood", "Bollywood", "Korean", "Japanese", "British", "European", "Asian"]


const HomePage = ({ navigateToPage = () => { } }) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedGenre, setSelectedGenre] = useState("all")
  const [selectedRegion, setSelectedRegion] = useState("all")
  const [hoveredCard, setHoveredCard] = useState(null)

  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const query = new URLSearchParams({
    search: searchQuery || "",
    type: selectedType || "all",
    genre: selectedGenre || "all",
    region: selectedRegion || "all",
  }).toString()

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    fetch(`localhost:5000/getItemOf?${query}`, { method: "GET" })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setItems(Array.isArray(data?.items) ? data.items : [])
      })
      .catch((err) => {
        console.log("[v0] Fetch error:", err)
        setError("Failed to load content")
        setItems([])
      })
      .finally(() => setIsLoading(false))
  }, [query])

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

        {/* Optional Error Banner */}
        {error && (
          <div className="max-w-4xl mx-auto mb-6">
            <Card>
              <CardContent>
                <p className="text-red-300">{error}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filter Section */}
        <div className="max-w-4xl mx-auto mb-12">
          <Card>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Search movies, series, music, books, games..."
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  value={selectedType}
                  onValueChange={setSelectedType}
                  placeholder="Type"
                  className="bg-white/5 border-white/20 text-white"
                >
                  <option value="all">All Types</option>
                  {entertainmentTypes.map((type) => (
                    <option key={type.id} value={type.id} className="bg-slate-800">
                      {type.name}
                    </option>
                  ))}
                </Select>

                <Select
                  value={selectedGenre}
                  onValueChange={setSelectedGenre}
                  placeholder="Genre"
                  className="bg-white/5 border-white/20 text-white"
                >
                  <option value="all">All Genres</option>
                  {genres.map((genre) => (
                    <option key={genre} value={genre} className="bg-slate-800">
                      {genre}
                    </option>
                  ))}
                </Select>

                <Select
                  value={selectedRegion}
                  onValueChange={setSelectedRegion}
                  placeholder="Region"
                  className="bg-white/5 border-white/20 text-white"
                >
                  <option value="all">All Regions</option>
                  {regions.map((region) => (
                    <option key={region} value={region} className="bg-slate-800">
                      {region}
                    </option>
                  ))}
                </Select>
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
            {entertainmentTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${selectedType === type.id ? "bg-white/20 text-white" : "text-white/70 hover:text-white"
                  }`}
              >
                <type.icon className="w-4 h-4" />
                {type.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
              <Card key={index} className="animate-pulse">
                <CardContent>
                  <div className="w-12 h-12 bg-white/20 rounded-lg mb-4"></div>
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
                  className="group relative overflow-hidden hover:border-purple-400 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/25"
                  onMouseEnter={() => setHoveredCard(item.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`,
                  }}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${typeInfo?.color} opacity-0 group-hover:opacity-20 transition-opacity duration-300`}
                  ></div>

                  <CardContent>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-lg bg-gradient-to-br ${typeInfo?.color}`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      {item.trending && (
                        <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                      {item.title}
                    </h3>

                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-white font-semibold">{item.rating}</span>
                      <span className="text-gray-400">({item.genre})</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="bg-white/10 text-white border-white/20">
                        {item.region}
                      </Badge>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-white hover:text-purple-300 hover:bg-white/10"
                        >
                          <Heart className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-white hover:text-purple-300 hover:bg-white/10"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {hoveredCard === item.id && (
                      <div
                        className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6"
                        style={{ animation: "fadeIn 0.3s ease-out" }}
                      >
                        <div className="w-full">
                          <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                            View Details
                          </Button>
                        </div>
                      </div>
                    )}
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

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.6s ease-out;
        }
      `}</style>
    </div>
  )
}

export default HomePage
