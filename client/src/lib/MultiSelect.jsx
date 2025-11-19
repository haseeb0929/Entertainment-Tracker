import { useState, useEffect, useRef } from 'react';

export function MultiSelect({ value = [], onChange, options = [], placeholder = 'Select', emptyLabel = 'No options' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleValue = (val) => {
    const exists = value.includes(val);
    const next = exists ? value.filter(v => v !== val) : [...value, val];
    onChange(next);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white hover:bg-white/20 focus:outline-none"
      >
        {value.length === 0 ? (
          <span className="text-white/50">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {value.map(v => (
              <span key={v} className="bg-purple-600/60 text-white px-2 py-0.5 rounded text-xs">{v}</span>
            ))}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-full bg-slate-800 border border-white/20 rounded-lg shadow-lg max-h-64 overflow-auto">
          {options.length === 0 && (
            <div className="px-3 py-2 text-white/50 text-sm">{emptyLabel}</div>
          )}
          {options.map(opt => {
            const active = value.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleValue(opt.value)}
                className={`flex items-center w-full text-left px-3 py-2 text-sm transition-colors ${active ? 'bg-purple-600/40 text-white' : 'text-white/80 hover:bg-white/10'}`}
              >
                <span className={`inline-block w-4 h-4 mr-2 rounded border border-white/30 ${active ? 'bg-purple-500' : 'bg-transparent'}`}></span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
