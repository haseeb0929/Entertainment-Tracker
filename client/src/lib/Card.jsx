export const Card = ({ children, className = "" }) => (
  <div className={`bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl ${className}`}>{children}</div>
)