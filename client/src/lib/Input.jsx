export const Input = ({ placeholder, value, onChange, type = "text", className = "", icon = null }) => (
  <div className="relative">
    {icon && <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">{icon}</div>}
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`w-full px-3 py-2 ${icon ? "pl-10" : ""} bg-white/5 border border-white/20 text-white rounded-lg placeholder-gray-400 focus:border-purple-400 focus:outline-none ${className}`}
    />
  </div>
);