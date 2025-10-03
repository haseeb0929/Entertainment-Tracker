export const Select = ({ value, onValueChange, children, placeholder, className = "" }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={`w-full px-3 py-2 bg-white/5 border border-white/20 text-white rounded-lg appearance-none cursor-pointer focus:border-purple-400 focus:outline-none ${className}`}
    >
      <option value="" disabled className="bg-slate-800">
        {placeholder}
      </option>
      {children}
    </select>
    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
)
