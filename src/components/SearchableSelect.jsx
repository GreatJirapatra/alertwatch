import { useEffect, useRef, useState } from 'react'

// Select ที่พิมพ์ค้นหาได้ — ใช้ตอนตัวเลือกเยอะ (เช่น 77 จังหวัด) ที่ scroll dropdown ธรรมดาจะยาวเกินไป
export function SearchableSelect({ label, value, onChange, options, placeholder }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <div ref={containerRef} className="relative">
      <label className="text-xs text-slate-400">{label}</label>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          setQuery('')
        }}
        className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm text-left focus:outline-none focus:border-teal-500 flex items-center justify-between"
      >
        <span className={selected ? '' : 'text-slate-500'}>
          {selected ? selected.label : (placeholder || 'เลือก...')}
        </span>
        <svg className="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-xl flex flex-col">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="พิมพ์เพื่อค้นหา..."
            className="px-3 py-2 bg-slate-800 border-b border-slate-700 text-white text-sm focus:outline-none rounded-t-lg"
          />
          <div className="overflow-y-auto max-h-56">
            <button
              type="button"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-800"
            >
              {placeholder || 'ไม่ระบุ'}
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-500">ไม่พบตัวเลือกที่ค้นหา</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 ${o.value === value ? 'text-teal-400' : 'text-white'}`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
