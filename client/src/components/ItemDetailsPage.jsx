import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Film,
  Tv,
  Music,
  Book,
  Star,
  Heart,
  Play,
  TrendingUp,
  Globe,
  AlertCircle,
} from "lucide-react";
import { Navigation } from "../lib/Navigation";
import { Button } from "../lib/Button";
import { Badge } from "../lib/Badge";
import { useAuth } from "../utils/AuthContext";

const entertainmentTypes = [
  { id: "movies", name: "Movies", icon: Film, gradient: "from-red-600 via-pink-500 to-rose-400" },
  { id: "series", name: "TV Series", icon: Tv, gradient: "from-indigo-600 via-blue-500 to-sky-400" },
  { id: "music", name: "Music", icon: Music, gradient: "from-green-500 via-emerald-400 to-teal-400" },
  { id: "books", name: "Books", icon: Book, gradient: "from-yellow-500 via-amber-400 to-orange-400" },
  { id: "anime", name: "Anime", icon: Tv, gradient: "from-purple-500 via-fuchsia-400 to-pink-400" },
];

const ItemDetailsPage = ({ item, navigateToPage = () => {} }) => {
  const { auth } = useAuth();
  const [details] = useState(item || null);
  const [error, setError] = useState(null);
  const [pubReviews, setPubReviews] = useState([]);
  const [pubLoading, setPubLoading] = useState(false);
  const [pubError, setPubError] = useState(null);

  if (!details) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <AlertCircle className="w-16 h-16 mb-4 text-gray-400" />
        <h2 className="text-2xl font-semibold mb-2">No item selected</h2>
        <Button
          onClick={() => navigateToPage("home")}
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  const typeInfo = entertainmentTypes.find((t) => t.id === details?.type) || entertainmentTypes[0];
  const Icon = typeInfo.icon;
  const backgroundImage = details?.thumbnail?.replace("http://", "https://");

  const handleAdd = async () => {
    if (!auth?.user?.id) {
      setError("Please sign in to save this item.");
      return;
    }
    try {
      const res = await fetch("http://localhost:5000/api/profile/saveItem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
        },
        body: JSON.stringify({
          userId: auth.user.id,
          item: {
            url: details.url || details.thumbnail || `https://example.com/${details.title}`,
            name: details.title,
            description: details.description || "",
            status: "currently_watching",
            type: details.type || "unknown",
            thumbnail: details.thumbnail || "",
            externalId: details.id || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Failed to save");
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  // Fetch public reviews for this item (aggregated from all users)
  useEffect(() => {
    if (!details) return;
    setPubLoading(true);
    setPubError(null);
    try {
      const params = new URLSearchParams();
      if (details.id) params.append("externalId", details.id);
      if (details.url) params.append("url", details.url);
      if (details.title) params.append("name", details.title);
      if (details.type) params.append("type", details.type);
      fetch(`http://localhost:5000/getItemsOf/reviews?${params.toString()}`)
        .then(r => r.json())
        .then(d => {
          if (d && Array.isArray(d.reviews)) setPubReviews(d.reviews);
          else setPubReviews([]);
        })
        .catch(err => setPubError(err.message || 'Failed to load comments'))
        .finally(() => setPubLoading(false));
    } catch (e) {
      setPubError(e.message);
      setPubLoading(false);
    }
  }, [details]);

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden text-white">
      <Navigation currentPage="itemDetails" navigateToPage={navigateToPage} />

      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center brightness-[0.3]"
        style={{
          backgroundImage: `url(${backgroundImage})`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/80 to-slate-950" />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-24 mt-20">
        <div className="flex flex-col lg:flex-row items-start gap-10 animate-fade-in">
          
          {/* Left: Image + Buttons below */}
          <div className="flex flex-col items-center lg:w-1/3 w-full">
            <div
              className="w-64 aspect-[3/4] rounded-2xl shadow-2xl border border-white/10 bg-cover bg-center"
              style={{ backgroundImage: `url(${backgroundImage})` }}
            />

            {/* Buttons stacked below image */}
            <div className="flex flex-col gap-3 mt-5 w-full max-w-xs">
              <Button
                onClick={handleAdd}
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3"
              >
                <Heart className="w-4 h-4 mr-2" /> Add to List
              </Button>
            </div>
          </div>

          {/* Right: Name, Rating, and Info */}
          <div className="lg:w-2/3 w-full space-y-6">
            {/* Title + Type + Rating */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-4xl font-bold">{details.title}</h1>
                <Badge className={`bg-gradient-to-r ${typeInfo.gradient} text-white px-4 py-1`}>
                  {typeInfo.name}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-gray-200">
                <div className="flex items-center gap-2">
                  <Star className="text-yellow-400 fill-current w-5 h-5" />
                  <span className="text-lg font-semibold">{details.rating || details.popularity || "N/A"}</span>
                </div>
                {details.popularity && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="text-green-400 w-5 h-5" />
                    <span>{details.popularity}</span>
                  </div>
                )}
                {details.language && (
                  <div className="flex items-center gap-2">
                    <Globe className="text-blue-400 w-5 h-5" />
                    <span>{details.language}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description + Details */}
            <div className="text-gray-300 leading-relaxed text-base lg:text-lg space-y-4">
              <p>{details.description || "No description available."}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {details.type === 'books' ? (
                  (details.categories && details.categories.length > 0) ? (
                    <div>
                      <span className="font-medium text-white">Categories: </span>
                      {details.categories.join(', ')}
                    </div>
                  ) : (details.genre && (
                    <div>
                      <span className="font-medium text-white">Category: </span>
                      {details.genre}
                    </div>
                  ))
                ) : (
                  (details.genres && details.genres.length > 0) ? (
                    <div>
                      <span className="font-medium text-white">Genres: </span>
                      {details.genres.join(', ')}
                    </div>
                  ) : (details.genre && (
                    <div>
                      <span className="font-medium text-white">Genre: </span>
                      {details.genre}
                    </div>
                  ))
                )}
                {details.region && (
                  <div>
                    <span className="font-medium text-white">Region: </span>
                    {details.region}
                  </div>
                )}
                {details.language && (
                  <div>
                    <span className="font-medium text-white">Language: </span>
                    {details.language}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-10 text-center text-red-400 flex justify-center items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Public Comments */}
        <div className="mt-14">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-semibold text-white">Public comments</h3>
            <span className="text-sm text-white/60">{pubReviews.length} total</span>
          </div>
          <div className="space-y-3">
            {pubLoading ? (
              <div className="text-gray-400">Loading comments...</div>
            ) : pubError ? (
              <div className="text-red-400">{pubError}</div>
            ) : pubReviews.length === 0 ? (
              <div className="text-gray-400">No public comments yet.</div>
            ) : (
              pubReviews.map((rv, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/10 flex gap-4">
                  {/* Avatar */}
                  {rv.avatarUrl ? (
                    <img src={rv.avatarUrl} alt={rv.user?.username || 'user'} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-semibold">
                      {(rv.user?.name || rv.user?.username || 'U').substring(0,2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-white font-medium truncate">{rv.user?.name || 'Anonymous'}</div>
                        <div className="text-xs text-white/70 truncate">@{rv.user?.username || 'user'}</div>
                      </div>
                      {/* Rating */}
                      <div className="flex items-center gap-1 text-yellow-400 flex-shrink-0">
                        {[1,2,3,4,5].map(n => (
                          <Star key={n} className={`w-4 h-4 ${n <= (rv.rating || 0) ? 'fill-current' : 'opacity-30'}`} />
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 text-gray-200 whitespace-pre-wrap break-words">{rv.review}</div>
                    <div className="mt-2 text-xs text-white/60 flex items-center gap-3">
                      <span className="capitalize">Status: {(rv.status || 'currently_watching').replace('_',' ')}</span>
                      {typeof rv.rewatchCount === 'number' && rv.rewatchCount > 0 && (
                        <span>Rewatches: {rv.rewatchCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-20 flex justify-center">
          <Button
            variant="outline"
            onClick={() => navigateToPage("home")}
            className="text-white border-white/30 hover:bg-white/10 px-8 py-3 text-lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>

      {/* Animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out both;
        }
      `}</style>
    </div>
  );
};

export default ItemDetailsPage;
