export const Textarea = ({ placeholder, value, onChange, className = "", rows = 3 }) => (
  <textarea
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    rows={rows}
    className={`w-full px-3 py-2 bg-white/5 border border-white/20 text-white rounded-lg placeholder-gray-400 focus:border-purple-400 focus:outline-none resize-none ${className}`}
  />
)