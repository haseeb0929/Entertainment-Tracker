import React, { useState, useEffect, useRef } from "react"
import { Settings, Heart, Star, Clock, TrendingUp, Award,
  Camera, Edit3, Save, X, Film, Music, Book, Gamepad2, Tv,
  MapPin, Calendar, Mail, Link2, Shield,
} from "lucide-react"
import { Navigation } from "../lib/Navigation"
import { Card } from "../lib/Card"
import { CardContent } from "../lib/CardContent"
import { Input } from "../lib/Input"
import { Button } from "../lib/Button"
import { Badge } from "../lib/Badge"
import { useAuth } from "../utils/AuthContext"

export const Avatar = ({ src, alt, children, className = "" }) => (
  <div
    className={`relative inline-flex items-center justify-center w-24 h-24 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-1 ${className}`}
  >
    <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
      {src ? (
        <img src={src || "/placeholder.svg"} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <span className="text-3xl font-bold text-white bg-gradient-to-br from-purple-600 to-pink-600 w-full h-full flex items-center justify-center">
          {children}
        </span>
      )}
    </div>
  </div>
)

export const Textarea = ({ placeholder, value, onChange, className = "", rows = 3 }) => (
  <textarea
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    rows={rows}
    className={`w-full px-3 py-2 bg-white/5 border border-white/20 text-white rounded-lg placeholder-gray-400 focus:border-purple-400 focus:outline-none resize-none ${className}`}
  />
)

export const Tabs = ({ children, defaultValue, onValueChange }) => {
  const [activeTab, setActiveTab] = useState(defaultValue)

  const handleTabChange = (value) => {
    setActiveTab(value)
    if (onValueChange) onValueChange(value)
  }

  return (
    <div className="space-y-6">
      {React.Children.map(children, (child) => {
        if (child.type === TabsList) {
          return React.cloneElement(child, { activeTab, onTabChange: handleTabChange })
        }
        if (child.type === TabsContent) {
          return React.cloneElement(child, { activeTab })
        }
        return child
      })}
    </div>
  )
}

export const TabsList = ({ children, activeTab, onTabChange }) => (
  <div className="grid w-full grid-cols-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg p-1">
    {React.Children.map(children, (child) =>
      React.cloneElement(child, {
        active: activeTab === child.props.value,
        onClick: () => onTabChange(child.props.value),
      }),
    )}
  </div>
)

export const TabsTrigger = ({ children, value, active, onClick }) => (
  <button
    onClick={onClick}
    className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${active ? "bg-white/20 text-white" : "text-white/70 hover:text-white"
      }`}
  >
    {children}
  </button>
)

export const TabsContent = ({ children, value, activeTab }) =>
  activeTab === value ? <div className="space-y-4">{children}</div> : null

export const Switch = ({ checked, onCheckedChange }) => (
  <button
    onClick={() => onCheckedChange(!checked)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-purple-500" : "bg-gray-600"
      }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"
        }`}
    />
  </button>
)

function getIconForType(type) {
  switch (type) {
    case "Movies": return Film;
    case "TV Series": return Tv;
    case "Music": return Music;
    case "Books": return Book;
    case "Games": return Gamepad2;
    default: return Film;
  }
}

function getColorForType(type) {
  switch (type) {
    case "Movies": return "from-red-500 to-pink-500";
    case "TV Series": return "from-blue-500 to-purple-500";
    case "Music": return "from-green-500 to-teal-500";
    case "Books": return "from-yellow-500 to-orange-500";
    case "Games": return "from-purple-500 to-indigo-500";
    default: return "from-gray-500 to-gray-700";
  }
}

const ProfilePage = ({ navigateToPage }) => {
  const [profileData, setProfileData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [tempProfileData, setTempProfileData] = useState(profileData);
  const [showEmail, setShowEmail] = useState(false);
  const [showLocation, setShowLocation] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const fileInputRef = useRef(null);

  // New: single fetch for all profile data
const { auth } = useAuth();
const userId = auth.user?.id; // or auth.user?._id depending on your backend
console.log("now idf is: ", userId);
  useEffect(() => {
    console.log("Fetching profile for userId:", userId);
    if (!userId) return;
    console.log("UserID:", userId);
    fetch(`http://localhost:5000/api/profile/${userId}`)
      .then(res => res.json())
      .then(data => {
        data.name = auth.user?.name;
        setProfileData(data);
        setTempProfileData(data);
        console.log("is data empty",data);
      })
      .catch(err => console.error(err));
  }, []);

  // Defensive fallback for stats, lists, activity
  const stats = Array.isArray(profileData?.stats) ? profileData.stats : [];
  const recentActivity = Array.isArray(profileData?.activity) ? profileData.activity : [];
  const userLists = Array.isArray(profileData?.lists) ? profileData.lists : [];

  const handleEdit = () => {
    setTempProfileData(profileData)
    setIsEditing(true)
  }

  const handleSave = () => {
    fetch(`http://localhost:5000/api/profile/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tempProfileData),
    })
      .then(res => res.json())
      .then(data => {
        setProfileData(data)
        setIsEditing(false)
      })
      .catch(err => console.error(err));
  }


  const handleCancel = () => {
    setTempProfileData(profileData)
    setIsEditing(false)
  }

  const handleImageUpload = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navigation currentPage="profile" navigateToPage={navigateToPage} />

      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
        <div
          className="absolute bottom-20 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute top-1/2 left-1/3 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"
          style={{ animationDelay: "4s" }}
        ></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 pt-24 py-8">
        {/* Profile Header */}
        <Card className="mb-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10"></div>

          <div className="relative z-10 p-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Profile Picture */}
              <div className="relative group">
                <Avatar>AT</Avatar>
                <button
                  onClick={handleImageUpload}
                  className="absolute bottom-0 right-0 w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white shadow-lg transform transition-all duration-300 hover:scale-110 hover:rotate-12"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => console.log("Image uploaded:", e.target.files?.[0])}
                />
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center md:text-left">

                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                  {profileData ? (
                    isEditing ? (
                      <Input
                        value={tempProfileData?.name || ""}
                        onChange={(e) => setTempProfileData({ ...tempProfileData, name: e.target.value })}
                        className="text-3xl font-bold text-white bg-white/10 border-white/20 text-center md:text-left"
                      />
                    ) : (
                      <h1 className="text-3xl md:text-4xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                        {profileData.name || "No Name"}
                      </h1>
                    )
                  ) : (
                    <h1 className="text-3xl md:text-4xl font-bold text-white">Profile name not set</h1>
                  )}
                  <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1">
                    PRO Member
                  </Badge>
                </div>

                {profileData ? (
                  isEditing ? (
                    <Input
                      value={tempProfileData?.username || ""}
                      onChange={(e) => setTempProfileData({ ...tempProfileData, username: e.target.value })}
                      className="text-lg text-gray-300 bg-white/10 border-white/20 mb-4 text-center md:text-left"
                    />
                  ) : (
                    <p className="text-lg text-gray-300 mb-4">{profileData.username || "No username set"}</p>
                  )
                ) : (
                  <p className="text-lg text-gray-300 mb-4">No username set</p>
                )}

                {profileData ? (
                  isEditing ? (
                    <Textarea
                      value={tempProfileData?.bio || ""}
                      onChange={(e) => setTempProfileData({ ...tempProfileData, bio: e.target.value })}
                      className="text-gray-300 bg-white/10 border-white/20 mb-4"
                      rows={3}
                    />
                  ) : (
                    <p className="text-gray-300 mb-6 max-w-2xl">{profileData.bio || "No bio provided."}</p>
                  )
                ) : (
                  <p className="text-gray-300 mb-6 max-w-2xl">No bio provided.</p>
                )}

                <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-6">
                  {showLocation && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {isEditing ? (
                        <Input
                          value={tempProfileData?.location || ""}
                          onChange={(e) => setTempProfileData({ ...tempProfileData, location: e.target.value })}
                          className="bg-white/10 border-white/20 text-white"
                        />
                      ) : (
                        <span>{profileData?.location || "Not set"}</span>
                      )}
                    </div>
                  )}
                  {showEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {isEditing ? (
                        <Input
                          value={tempProfileData?.email || ""}
                          onChange={(e) => setTempProfileData({ ...tempProfileData, email: e.target.value })}
                          className="bg-white/10 border-white/20 text-white"
                        />
                      ) : (
                        <span>{profileData?.email || "Not set"}</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
   
                    <span>Joined {profileData?.joinDate ? new Date(profileData.joinDate).toLocaleDateString() : "Not set"}</span>
                  </div>
                  {profileData?.website ? (
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      <a href={profileData.website} className="text-purple-400 hover:text-purple-300" target="_blank" rel="noopener noreferrer">
                        {profileData.website}
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      <span>Not set</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  {isEditing ? (
                    <>
                      <Button
                        onClick={handleSave}
                        className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button
                        onClick={handleCancel}
                        variant="outline"
                        className="border-white/20 text-white hover:bg-white/10 bg-transparent"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={handleEdit}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  )}
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 bg-transparent">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Stats Grid */}
        {showStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {stats.map((stat, index) => (
              <Card
                key={stat.type}
                className="hover:border-purple-400 transition-all duration-300 hover:scale-105"
                style={{
                  animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`,
                }}
              >
                <CardContent className="p-6 text-center">
                  <div
                    className={`w-12 h-12 mx-auto mb-3 rounded-lg bg-gradient-to-br ${getColorForType(stat.type)} flex items-center justify-center`}
                  >
                    {getIconForType(stat.type) && React.createElement(getIconForType(stat.type), { className: "w-6 h-6 text-white" })}
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{stat.count}</div>
                  <div className="text-sm text-gray-400">{stat.type}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="activity">
          <TabsList>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="lists">My Lists</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
          </TabsList>

          <TabsContent value="activity">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Recent Activity
                </h3>
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                          {activity.type === "movie" && <Film className="w-5 h-5 text-white" />}
                          {activity.type === "music" && <Music className="w-5 h-5 text-white" />}
                          {activity.type === "series" && <Tv className="w-5 h-5 text-white" />}
                          {activity.type === "book" && <Book className="w-5 h-5 text-white" />}
                        </div>
                        <div>
                          <h4 className="text-white font-semibold">{activity.title}</h4>
                          <p className="text-gray-400 text-sm">
                            {activity.action} • {activity.time}
                          </p>
                        </div>
                      </div>
                      {activity.rating > 0 && (
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${i < activity.rating ? "text-yellow-400 fill-current" : "text-gray-600"}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lists">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {userLists.map((list) => (
                <Card key={list.id} className="hover:border-purple-400 transition-all duration-300 hover:scale-105">
                  <CardContent className="p-6">
                    <div
                      className={`w-12 h-12 rounded-lg bg-gradient-to-br ${list.color} flex items-center justify-center mb-4`}
                    >
                      <Heart className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{list.name}</h3>
                    <p className="text-gray-400 mb-4">{list.count} items</p>
                    <Button
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10 w-full bg-transparent"
                    >
                      View List
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="achievements">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Achievements
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                      <Star className="w-10 h-10 text-white" />
                    </div>
                    <h4 className="text-white font-semibold mb-2">Super Watcher</h4>
                    <p className="text-gray-400 text-sm">Watched 100+ movies</p>
                  </div>
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-10 h-10 text-white" />
                    </div>
                    <h4 className="text-white font-semibold mb-2">Trendsetter</h4>
                    <p className="text-gray-400 text-sm">50 trending items watched</p>
                  </div>
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center">
                      <Award className="w-10 h-10 text-white" />
                    </div>
                    <h4 className="text-white font-semibold mb-2">Explorer</h4>
                    <p className="text-gray-400 text-sm">Discovered 200+ new items</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Privacy Settings
                </h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-semibold">Show Email</h4>
                      <p className="text-gray-400 text-sm">Display email on your profile</p>
                    </div>
                    <Switch checked={showEmail} onCheckedChange={setShowEmail} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-semibold">Show Location</h4>
                      <p className="text-gray-400 text-sm">Display location on your profile</p>
                    </div>
                    <Switch checked={showLocation} onCheckedChange={setShowLocation} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-semibold">Show Statistics</h4>
                      <p className="text-gray-400 text-sm">Display your entertainment stats</p>
                    </div>
                    <Switch checked={showStats} onCheckedChange={setShowStats} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-semibold">Private Profile</h4>
                      <p className="text-gray-400 text-sm">Only followers can see your activity</p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
      `}</style>
    </div>
  )
}

export default ProfilePage
