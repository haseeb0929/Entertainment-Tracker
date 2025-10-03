import React from "react";
import { useAuth } from "../utils/AuthContext";
import { Search, Home, User, LogIn } from "lucide-react";

export const Navigation = ({ currentPage = "home", navigateToPage = () => { } }) => {
    const { auth } = useAuth();
    const isAuthenticated = !!auth?.accessToken;

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-lg border-b border-white/20">
            <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigateToPage("home")}>
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                            <Search className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-xl font-bold text-white">Entertainment Hub</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigateToPage("home")}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${currentPage === "home" ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                                }`}
                        >
                            <Home className="w-4 h-4" />
                            Home
                        </button>
                        <button
                            onClick={() =>
                                isAuthenticated
                                    ? navigateToPage("profile")
                                    : navigateToPage("auth")
                            }
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${currentPage === "profile" ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                                }`}
                        >
                            <User className="w-4 h-4" />
                            Profile
                        </button>
                        <button
                            onClick={() => navigateToPage("auth")}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-all"
                        >
                            <LogIn className="w-4 h-4" />
                            Login
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
};