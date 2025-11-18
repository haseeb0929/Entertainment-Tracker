export const Select = ({ value, onValueChange, children, placeholder, className = "" }) => (
  <div className="relative group">
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={`w-full pl-4 pr-10 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl appearance-none cursor-pointer backdrop-blur-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:border-purple-400/60 ${className}`}
    >
      <option value="" disabled className="bg-slate-900 text-white">
        {placeholder}
      </option>
      {children}
    </select>
    {/* Chevron */}
    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-300 group-hover:text-white transition-colors">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
)
