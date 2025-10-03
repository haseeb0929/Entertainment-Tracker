import { useState, useEffect } from "react"
import { useAuth } from "../utils/AuthContext"
import {
  Eye, EyeOff, Mail, Lock, User, ArrowRight,
  Sparkles, Film, Music, Book, Gamepad2, Tv, CheckCircle,
  AlertCircle
} from "lucide-react"
import { Card } from "../lib/Card"
import { CardContent } from "../lib/CardContent"
import { Input } from "../lib/Input"
import { Button } from "../lib/Button"


const entertainmentIcons = [Film, Music, Book, Gamepad2, Tv]
const FLOATING_ICON_COUNT = 10

const Checkbox = ({ checked, onCheckedChange, children }) => (
  <label className="flex items-center space-x-2 cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      className="w-4 h-4 text-purple-500 bg-white/10 border-white/20 rounded focus:ring-purple-500 focus:ring-2"
    />
    <span className="text-sm text-gray-300">{children}</span>
  </label>
)

export default function AuthPage({ navigateToPage = () => { } }) {
  const { setAuth } = useAuth();
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  })
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState("")
  const [floatingIcons, setFloatingIcons] = useState([])

  useEffect(() => {
    const icons = Array.from({ length: FLOATING_ICON_COUNT }).map((_, i) => {
      const Icon = entertainmentIcons[i % entertainmentIcons.length]
      return {
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        icon: Icon,
        delay: Math.random() * 5, // random stagger
        duration: 12 + Math.random() * 10, // 12s - 22s
      }
    })
    setFloatingIcons(icons)
  }, [])

  const validateForm = () => {
    const newErrors = {}

    if (!isLogin && !formData.name.trim()) {
      newErrors.name = "Name is required"
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format"
    }

    if (!formData.password) {
      newErrors.password = "Password is required"
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters"
    }

    if (!isLogin && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    if (!isLogin && !formData.agreeTerms) {
      newErrors.agreeTerms = "You must agree to the terms"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSuccess("")

    if (!validateForm()) return

    setIsLoading(true)

    try {
      const url = isLogin
        ? "http://localhost:5000/auth/login"
        : "http://localhost:5000/auth/register"

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // important for sessions (cookies)
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      })

      const data = await response.json()
      setIsLoading(false)

      if (!response.ok) {
        setErrors({ general: data.msg || "Something went wrong" })
        return
      }

      if (isLogin) {
        setSuccess("Login successful! Redirecting...")
        setAuth({ accessToken: data.accessToken, user: data.user });
         console.log("haha phonch gya");
        setTimeout(() => {
          navigateToPage("profile");
        }, 1500)
      } else {
        setSuccess("Account created successfully! Please log in.")
        setTimeout(() => {
          setIsLogin(true)
          setFormData({ name: "", email: "", password: "", confirmPassword: "", agreeTerms: false })
        }, 1500)
      }
    } catch (error) {
      setIsLoading(false)
      setErrors({ general: error.message })
    }
  }


  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {floatingIcons.map((item) => (
          <div
            key={item.id}
            className="absolute animate-float"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              animationDelay: `${item.delay}s`,
              animationDuration: `${item.duration}s`,
            }}
          >
            <item.icon className="w-8 h-8 text-white/10" />
          </div>
        ))}

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

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-4 transform rotate-12 hover:rotate-0 transition-transform duration-300">
              <Sparkles className="w-10 h-10 text-white transform -rotate-12" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
              Entertainment Hub
            </h1>
            <p className="text-gray-300">
              {isLogin ? "Welcome back! Continue your journey" : "Start your entertainment journey today"}
            </p>
          </div>

          {/* Auth Card */}
          <Card className="shadow-2xl">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Tab Toggle */}
                <div className="grid w-full grid-cols-2 bg-white/5 mb-8 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setIsLogin(true)}
                    className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${isLogin ? "bg-white/20 text-white" : "text-white/70 hover:text-white"
                      }`}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLogin(false)}
                    className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${!isLogin ? "bg-white/20 text-white" : "text-white/70 hover:text-white"
                      }`}
                  >
                    Sign Up
                  </button>
                </div>

                {/* Sign Up Name Field */}
                {!isLogin && (
                  <div className="space-y-2" style={{ animation: "slideIn 0.3s ease-out" }}>
                    <label className="text-sm font-medium text-gray-300">Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <Input
                        type="text"
                        placeholder="Enter your name"
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        icon={<User className="w-5 h-5" />}
                        className={`${errors.name ? "border-red-500" : ""}`}
                      />
                    </div>
                    {errors.name && (
                      <p className="text-red-400 text-sm flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.name}
                      </p>
                    )}
                  </div>
                )}

                {/* Email Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      icon={<Mail className="w-5 h-5" />}
                      className={`${errors.email ? "border-red-500" : ""}`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-400 text-sm flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      className={`w-full px-3 py-2 pl-10 pr-10 bg-white/5 border border-white/20 text-white rounded-lg placeholder-gray-400 focus:border-purple-400 focus:outline-none ${errors.password ? "border-red-500" : ""
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-400 text-sm flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Confirm Password Field */}
                {!isLogin && (
                  <div className="space-y-2" style={{ animation: "slideIn 0.3s ease-out" }}>
                    <label className="text-sm font-medium text-gray-300">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                        className={`w-full px-3 py-2 pl-10 pr-10 bg-white/5 border border-white/20 text-white rounded-lg placeholder-gray-400 focus:border-purple-400 focus:outline-none ${errors.confirmPassword ? "border-red-500" : ""
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-red-400 text-sm flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>
                )}

                {/* Terms Checkbox */}
                {!isLogin && (
                  <div style={{ animation: "slideIn 0.3s ease-out" }}>
                    <Checkbox
                      checked={formData.agreeTerms}
                      onCheckedChange={(checked) => handleInputChange("agreeTerms", checked)}
                    >
                      I agree to the Terms of Service and Privacy Policy
                    </Checkbox>
                  </div>
                )}
                {errors.agreeTerms && (
                  <p className="text-red-400 text-sm flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.agreeTerms}
                  </p>
                )}
                {errors.general && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    {errors.general}
                  </div>
                )}


                {/* Success Message */}
                {success && (
                  <div
                    className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-2 text-green-400"
                    style={{ animation: "slideIn 0.3s ease-out" }}
                  >
                    <CheckCircle className="w-5 h-5" />
                    {success}
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      {isLogin ? "Logging in..." : "Creating account..."}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      {isLogin ? "Login" : "Sign Up"}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </div>
                  )}
                </Button>
              </form>

              {/* Forgot Password */}
              {isLogin && (
                <div className="mt-6 text-center">
                  <a href="#" className="text-purple-400 hover:text-purple-300 text-sm transition-colors">
                    Forgot your password?
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Social Login */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/20"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-gray-400">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 transition-all duration-300 bg-transparent"
              >
                <div className="w-5 h-5 bg-white rounded mr-2"></div>
                Google
              </Button>
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 transition-all duration-300 bg-transparent"
              >
                <div className="w-5 h-5 bg-white rounded mr-2"></div>
                GitHub
              </Button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          33% {
            transform: translateY(-20px) rotate(120deg);
          }
          66% {
            transform: translateY(20px) rotate(240deg);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-float {
          animation: float 15s ease-in-out infinite;
        }

        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
