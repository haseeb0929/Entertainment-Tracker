import React from "react";

export const MenuSelect = ({
  value,
  onValueChange,
  options = [],
  placeholder = "Select",
  className = "",
  buttonClassName = "",
}) => {
  const current = options.find(o => o.value === value);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    const onDocClick = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full inline-flex items-center justify-between gap-2 rounded-md border border-white/20 bg-white/15 px-3 py-2 text-sm text-white hover:bg-white/20 transition backdrop-blur-sm ${buttonClassName}`}
      >
        <span className="truncate text-left">
          {current ? current.label : placeholder}
        </span>
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`absolute left-0 mt-2 w-full origin-top rounded-lg border border-white/10 bg-slate-900/95 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl z-[9999] transform transition ease-out duration-150 ${open ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}
      >
        <ul className="py-1 max-h-60 overflow-auto no-scrollbar">
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => { onValueChange && onValueChange(o.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm rounded-md ${
                  value === o.value
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
