import React, { useState, useEffect, useRef } from "react"
import {
  Settings, Heart, Star, Clock, TrendingUp, Award,
  Camera, Edit3, Save, X, Film, Music, Book, Gamepad2, Tv,
  MapPin, Calendar, Mail, Link2, Shield, ChevronDown, Plus, Minus,
} from "lucide-react"
import { Navigation } from "../lib/Navigation"
import axios from "axios"
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

export const TabsList = ({ children, activeTab, onTabChange }) => {
  // For exactly two tabs we want them to span full width evenly.
  const count = React.Children.count(children);
  const layoutClass = count === 2
    ? 'flex'
    : 'grid grid-cols-4';
  return (
    <div className={`${layoutClass} w-full bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg p-1`}>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, {
          active: activeTab === child.props.value,
          onClick: () => onTabChange(child.props.value),
          full: count === 2,
        }),
      )}
    </div>
  );
}

export const TabsTrigger = ({ children, value, active, onClick, full }) => (
  <button
    onClick={onClick}
    className={`${full ? 'flex-1 text-center' : ''} py-2 px-4 rounded-md text-sm font-medium transition-all ${active ? "bg-white/20 text-white" : "text-white/70 hover:text-white"}`}
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
  // Removed email/location UI
  // Removed old header stats grid; using dedicated Statistics tab instead
  const fileInputRef = useRef(null);
  const [openReviewId, setOpenReviewId] = useState(null);
  const [reviewDraft, setReviewDraft] = useState("");
  const [statsWindow, setStatsWindow] = useState("weekly"); // weekly | monthly | yearly
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
        console.log("is data empty", data);
      })
      .catch(err => console.error(err));
  }, []);

  // Fetch statistics when userId or window changes
  useEffect(() => {
    if (!userId) return;
    setStatsLoading(true);
    fetch(`http://localhost:5000/api/profile/${userId}/stats?window=${statsWindow}`)
      .then(res => res.json())
      .then(data => setStatsData(data))
      .catch(err => console.error(err))
      .finally(() => setStatsLoading(false));
  }, [userId, statsWindow]);

  // Defensive conversions for backend data shape
  // Stats now fetched from backend endpoint per selected window

  const userLists = Array.isArray(profileData?.lists) ? profileData.lists : [];
  const recentActivity = Array.isArray(profileData?.activity) ? profileData.activity : [];



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
                <Avatar src={avatarPreview || profileData?.avatarUrl}>{(profileData?.name || 'AT').substring(0,2).toUpperCase()}</Avatar>
                <button
                  onClick={handleImageUpload}
                  className="absolute bottom-0 right-0 w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white shadow-lg transform transition-all duration-300 hover:scale-110 hover:rotate-12"
                  title="Change avatar"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                    setAvatarFile(file);
                    setAvatarPreview(URL.createObjectURL(file));
                    setUploadProgress(0);
                  }}
                />
                {isUploading && (
                  <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}
                {avatarPreview && (
                  <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-2">
                    <Button
                      size="sm"
                      disabled={isUploading}
                      className="bg-gradient-to-r from-purple-500 to-pink-500"
                      onClick={async () => {
                        if (!avatarFile || !userId) return;
                        const form = new FormData();
                        form.append('avatar', avatarFile);
                        try {
                          setIsUploading(true);
                          setUploadProgress(0);
                          const res = await axios.post(`http://localhost:5000/api/profile/${userId}/avatar`, form, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                            onUploadProgress: (pe) => {
                              if (!pe.total) return;
                              const pct = Math.round((pe.loaded / pe.total) * 100);
                              setUploadProgress(pct);
                            }
                          });
                          const data = res.data;
                          const cacheBusted = `${data.avatarUrl}${data.avatarUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
                          setProfileData(p => p ? { ...p, avatarUrl: cacheBusted } : p);
                          if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                          setAvatarPreview(null);
                          setAvatarFile(null);
                        } catch (err) {
                          console.error(err);
                          alert('Failed to upload avatar');
                        } finally {
                          setIsUploading(false);
                          setTimeout(() => setUploadProgress(0), 300);
                        }
                      }}
                    >Save</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isUploading}
                      onClick={() => {
                        if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                        setAvatarPreview(null);
                        setAvatarFile(null);
                        setUploadProgress(0);
                      }}
                      className="border-white/20 text-white hover:bg-white/10"
                    >Cancel</Button>
                  </div>
                )}
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
                </div>


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
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />

                    <span>Joined {profileData?.joinDate ? new Date(profileData.joinDate).toLocaleDateString() : "Not set"}</span>
                  </div>
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
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Removed old header Stats Grid; stats moved to dedicated tab */}

        {/* Main Content Tabs */}
        <Tabs defaultValue="lists">
          <TabsList>
            <TabsTrigger value="lists">My Lists</TabsTrigger>
            <TabsTrigger value="statistics">Statistics</TabsTrigger>
          </TabsList>

          {/* Lists tab remains unchanged below */}

          <TabsContent value="lists">
            {userLists.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-gray-400">
                  No items saved yet. Tap the heart on any card to add it here.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {(() => {
                  const normalize = (s) => {
                    const x = (s || '').toLowerCase();
                    if (x === 'watched') return 'completed';
                    if (x === 'unwatched') return 'currently_watching';
                    if (x === 'hold') return 'on_hold';
                    return ['currently_watching','completed','dropped','on_hold'].includes(x) ? x : 'currently_watching';
                  };
                  const groups = userLists.reduce((acc, it) => {
                    const key = normalize(it.status);
                    (acc[key] = acc[key] || []).push(it);
                    return acc;
                  }, {});
                  const order = [
                    { key: 'currently_watching', title: 'Currently Watching' },
                    { key: 'completed', title: 'Completed' },
                    { key: 'dropped', title: 'Dropped' },
                    { key: 'on_hold', title: 'On Hold' },
                  ];

                  const iconMap = { movies: Film, series: Tv, music: Music, books: Book, games: Gamepad2 };
                  const badgeColor = (t) =>
                    t === 'movies' ? 'from-red-500 to-pink-500' :
                    t === 'series' ? 'from-blue-500 to-purple-500' :
                    t === 'music' ? 'from-green-500 to-teal-500' :
                    t === 'books' ? 'from-yellow-500 to-orange-500' :
                    t === 'games' ? 'from-purple-500 to-indigo-500' :
                    'from-gray-500 to-gray-700';

                  const StatusSelect = ({ value, onChange, onOpenChange }) => {
                    const opts = [
                      { key: 'currently_watching', label: 'Currently Watching' },
                      { key: 'completed', label: 'Completed' },
                      { key: 'dropped', label: 'Dropped' },
                      { key: 'on_hold', label: 'On Hold' },
                    ];
                    const current = opts.find(o => o.key === value) || opts[0];
                    const [open, setOpen] = React.useState(false);
                    return (
                      <div
                        className="relative inline-block text-left mt-9 pb-2"
                        tabIndex={0}
                        onBlur={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget)) {
                            setOpen(false);
                            onOpenChange && onOpenChange(false);
                          }
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(o => {
                              const next = !o;
                              onOpenChange && onOpenChange(next);
                              return next;
                            });
                          }}
                          className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/15 px-3 py-1.5 text-xs md:text-sm text-white hover:bg-white/20 transition"
                        >
                          <span className="truncate max-w-[9rem]">{current.label}</span>
                          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                        </button>
                        <div
                          className={`absolute right-0 mt-2 w-48 origin-top-right rounded-lg border border-white/10 bg-slate-900/95 shadow-2xl ring-1 ring-black/5 backdrop-blur-lg z-50 transform transition ease-out duration-150 ${open ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}
                        >
                          <ul className="py-1">
                            {opts.map((o) => (
                              <li key={o.key}>
                                <button
                                  type="button"
                                  onClick={() => { onChange(o.key); setOpen(false); }}
                                  className={`w-full text-left px-3 py-2 text-sm rounded-md ${
                                    value === o.key
                                      ? 'bg-white/10 text-white'
                                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                                  }`}
                                >
                                  {o.label}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  };

                  const handleStatusChange = async (li, newStatus) => {
                    try {
                      const payload = {
                        userId: auth.user?.id,
                        identifier: { externalId: li.externalId, url: li.url, name: li.name, type: li.type },
                        newStatus,
                      };
                      const res = await fetch('http://localhost:5000/api/profile/updateItemStatus', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.msg || 'Failed to update');
                      setProfileData((prev) => {
                        if (!prev) return prev;
                        const next = { ...prev, lists: [...(prev.lists || [])] };
                        const idx = next.lists.findIndex(x => (x.externalId && li.externalId && x.externalId === li.externalId) || x.url === li.url || (x.name === li.name && (x.type||'unknown') === (li.type||'unknown')));
                        if (idx !== -1) next.lists[idx] = { ...next.lists[idx], status: newStatus };
                        return next;
                      });
                    } catch (e) {
                      console.error(e);
                    }
                  };

                  const itemKey = (li) => li.externalId || `${li.url}|${li.name}|${li.type||'unknown'}`;

                  const patchMeta = async (li, patch) => {
                    try {
                      const payload = {
                        userId: auth.user?.id,
                        identifier: { externalId: li.externalId, url: li.url, name: li.name, type: li.type },
                        patch,
                      };
                      const res = await fetch('http://localhost:5000/api/profile/updateItemMeta', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.msg || 'Failed to update');
                      setProfileData((prev) => {
                        if (!prev) return prev;
                        const next = { ...prev, lists: [...(prev.lists || [])] };
                        const idx = next.lists.findIndex(x => (x.externalId && li.externalId && x.externalId === li.externalId) || x.url === li.url || (x.name === li.name && (x.type||'unknown') === (li.type||'unknown')));
                        if (idx !== -1) next.lists[idx] = { ...next.lists[idx], ...patch };
                        return next;
                      });
                    } catch (e) {
                      console.error(e);
                    }
                  };

                  return order.map(({ key, title }) => (
                    <div key={key}>
                      <h3 className="text-white text-xl font-bold mb-4">{title}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {(groups[key] || []).map((li, idx) => {
                          const t = (li.type || 'unknown').toLowerCase();
                          const Icon = iconMap[t] || Film;
                          return (
                            <Card key={`${li.url}-${idx}`} className="group relative h-96 hover:border-purple-400 transition-all duration-300 hover:scale-105 rounded-lg focus-within:z-50">
                              {li.thumbnail ? (
                                <img
                                  src={li.thumbnail.replace('http://', 'https://')}
                                  alt={li.name}
                                  className="absolute inset-0 w-full h-full object-cover rounded-lg"
                                />
                              ) : (
                                <div className="absolute inset-0 bg-slate-800 flex items-center justify-center text-gray-500 text-sm rounded-lg">No Image</div>
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 rounded-lg"></div>

                              <CardContent className="relative z-10 p-4 flex flex-col justify-between h-full opacity-0 group-hover:opacity-100 transition-all duration-300">
                                {/* Top row: type badge and actions */}
                                <div className="flex items-start justify-between">
                                  <div className={`inline-flex items-center gap-2`}>
                                    <div className={`w-8 h-8 rounded-md bg-gradient-to-br ${badgeColor(t)} flex items-center justify-center`}>
                                      <Icon className="w-5 h-5 text-white" />
                                    </div>
                                    <Badge className="bg-white/10 text-white border-white/20 capitalize text-xs">{t}</Badge>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {li.url && (
                                      <Button size="sm" variant="ghost" className="text-white hover:text-purple-300 hover:bg-white/20 p-2"
                                        onClick={(e) => { e.stopPropagation(); window.open(li.url, '_blank', 'noopener,noreferrer'); }}>
                                        <Link2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-white hover:text-red-300 hover:bg-white/20 p-2"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const ok = window.confirm(`Remove \"${li.name}\" from your list?`);
                                        if (!ok) return;
                                        try {
                                          const payload = {
                                            userId: auth.user?.id,
                                            identifier: { externalId: li.externalId, url: li.url, name: li.name, type: li.type },
                                          };
                                          const res = await fetch('http://localhost:5000/api/profile/deleteItem', {
                                            method: 'DELETE',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(payload),
                                          });
                                          const data = await res.json();
                                          if (!res.ok) throw new Error(data.msg || 'Failed to delete');
                                          setProfileData((prev) => {
                                            if (!prev) return prev;
                                            const next = { ...prev, lists: [...(prev.lists || [])] };
                                            const idx = next.lists.findIndex(x => (x.externalId && li.externalId && x.externalId === li.externalId) || x.url === li.url || (x.name === li.name && (x.type||'unknown') === (li.type||'unknown')));
                                            if (idx !== -1) next.lists.splice(idx, 1);
                                            return next;
                                          });
                                        } catch (e) {
                                          console.error(e);
                                        }
                                      }}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>

                                {/* Middle: title, rating, rewatch, and optional description */}
                                <div className="flex-1 flex flex-col justify-end gap-2">
                                  <h4 className="text-white font-semibold line-clamp-2">{li.name}</h4>
                                  <div className="flex items-center justify-between gap-3">
                                    {/* Star rating */}
                                    <div className="flex items-center gap-1">
                                      {[1,2,3,4,5].map(n => (
                                        <button
                                          key={n}
                                          type="button"
                                          aria-label={`Rate ${n}`}
                                          className="focus:outline-none"
                                          onClick={() => patchMeta(li, { rating: n })}
                                        >
                                          <Star className={`w-4 h-4 ${n <= (li.rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-400'}`} />
                                        </button>
                                      ))}
                                    </div>
                                    {/* Rewatch counter */}
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white"
                                        onClick={() => patchMeta(li, { rewatchCount: Math.max(0, (li.rewatchCount||0) - 1) })}
                                      >
                                        <Minus className="w-4 h-4" />
                                      </button>
                                      <span className="text-white text-sm min-w-[1.5rem] text-center">{li.rewatchCount || 0}</span>
                                      <button
                                        type="button"
                                        className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white"
                                        onClick={() => patchMeta(li, { rewatchCount: (li.rewatchCount||0) + 1 })}
                                      >
                                        <Plus className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                  {/* Description removed per request */}
                                </div>

                                {/* Bottom: status selector and review editor */}
                                <div className="flex items-center justify-between gap-2">
                                  <StatusSelect value={normalize(li.status)} onChange={(v) => handleStatusChange(li, v)} onOpenChange={(isOpen) => { /* elevate via focus-within; no state needed */ }} />
                                  <div className="relative">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-white/20 text-white bg-white/15 hover:bg-white/10 px-2 py-1 h-8 mt-7"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const k = itemKey(li);
                                        setOpenReviewId(prev => {
                                          const nextOpen = prev === k ? null : k;
                                          if (nextOpen) setReviewDraft(li.review || '');
                                          return nextOpen;
                                        });
                                      }}
                                    >
                                      {openReviewId === itemKey(li) ? 'Close Review' : 'Review'}
                                    </Button>
                                    {/* Popover for review editing */}
                                    <div className={`absolute right-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-lg border border-white/10 rounded-lg shadow-2xl p-3 z-50 ${openReviewId === itemKey(li) ? 'block' : 'hidden'}`}>
                                      <textarea
                                        value={reviewDraft}
                                        onChange={(e) => setReviewDraft(e.target.value)}
                                        rows={3}
                                        className="w-full bg-white/10 border border-white/20 text-white rounded-md p-2 text-sm placeholder-gray-400"
                                        placeholder="Write your thoughts..."
                                      />
                                      <div className="flex justify-end gap-2 mt-2 ">
                                        <Button size="sm" variant="ghost" className="text-white/80 hover:text-white"
                                          onClick={() => setOpenReviewId(null)}
                                        >Cancel</Button>
                                        <Button size="sm" className="bg-gradient-to-r from-purple-500 to-pink-500"
                                          onClick={async () => {
                                            await patchMeta(li, { review: reviewDraft });
                                            setOpenReviewId(null);
                                          }}
                                        >Save</Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </TabsContent>


          {/* Statistics Tab */}
          <TabsContent value="statistics">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Statistics
                  </h3>
                  <div className="inline-flex rounded-md overflow-hidden border border-white/20">
                    {["weekly","monthly","yearly"].map(win => (
                      <button
                        key={win}
                        onClick={() => setStatsWindow(win)}
                        className={`px-3 py-1.5 text-sm ${statsWindow===win ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                      >
                        {win.charAt(0).toUpperCase()+win.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {statsLoading ? (
                  <div className="text-gray-400">Loading...</div>
                ) : statsData ? (
                  <div className="space-y-8">
                    {(() => {
                      const sections = [
                        { key: 'completed', title: 'Completed', desc: 'Items you finished', icon: Star },
                        { key: 'rewatch', title: 'Rewatched', desc: 'Rewatch counts', icon: Clock },
                        { key: 'added', title: 'Added', desc: 'Items you started', icon: Plus },
                      ];
                      const typeMeta = [
                        { key: 'movies', label: 'Movies' },
                        { key: 'series', label: 'TV Series' },
                        { key: 'music', label: 'Music' },
                        { key: 'books', label: 'Books' },
                        { key: 'games', label: 'Games' },
                      ];
                      return sections.map((sec) => (
                        <div key={sec.key}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-white font-semibold flex items-center gap-2">
                              {sec.icon && React.createElement(sec.icon, { className: 'w-4 h-4' })}
                              {sec.title}
                            </h4>
                            <span className="text-sm text-gray-300">Total: {statsData.counts?.[sec.key]?.total || 0}</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {typeMeta.map(({ key, label }) => {
                              const Icon = getIconForType(label);
                              const color = getColorForType(label);
                              const val = statsData.counts?.[sec.key]?.[key] || 0;
                              return (
                                <Card key={`${sec.key}-${key}`} className="hover:border-purple-400 transition-all duration-300 hover:scale-105">
                                  <CardContent className="p-4 text-center">
                                    <div className={`w-10 h-10 mx-auto mb-2 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
                                      {Icon && React.createElement(Icon, { className: 'w-5 h-5 text-white' })}
                                    </div>
                                    <div className="text-xl font-bold text-white">{val}</div>
                                    <div className="text-xs text-gray-400">{label}</div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <div className="text-gray-400">No stats available.</div>
                )}
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
