import { useCallback, useEffect, useRef, useState } from 'react'
import { searchOptions } from '../lib/search'

// Select ที่พิมพ์ค้นหาได้ — ใช้ตอนตัวเลือกเยอะ (เช่น 77 จังหวัด, รายการ SKU)
// - ค้นแบบยืดหยุ่น: ไม่สนตัวพิมพ์/ขีดกลาง/ช่องว่าง, หลายคำ, ตัวย่อ (เช่น "s80" → SEAL-80KPA)
// - กด Enter เลือกรายการแรก, Esc ปิด
// - dropdown ลอยแบบ fixed จึงไม่โดนกรอบ scroll ที่ครอบอยู่ตัดขอบ และเปิดขึ้นด้านบนได้เมื่อที่ด้านล่างไม่พอ
export function SearchableSelect({ label, value, onChange, options, placeholder }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const containerRef = useRef(null)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)

  const selected = options.find((o) => String(o.value) === String(value))

  const updatePos = useCallback(() => {
    const el = buttonRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight
    const below = vh - r.bottom
    const openUp = below < 300 && r.top > below
    const room = (openUp ? r.top : below) - 16
    setPos({
      left: r.left,
      width: r.width,
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? vh - r.top + 4 : undefined,
      listMax: Math.max(120, Math.min(260, room - 48)),
    })
  }, [])

  useEffect(() => {
    if (!open) return undefined
    function handleOutside(e) {
      const inside = containerRef.current?.contains(e.target) || panelRef.current?.contains(e.target)
      if (!inside) setOpen(false)
    }
    function handleScroll(e) {
      // เลื่อนในรายการตัวเลือกเองไม่ต้องคำนวณตำแหน่งใหม่
      if (panelRef.current?.contains(e.target)) return
      updatePos()
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', updatePos)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open, updatePos])

  const filtered = searchOptions(options, query)

  function choose(v) {
    onChange(v)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {label ? <label className="text-xs text-slate-400">{label}</label> : null}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open) updatePos()
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

      {open && pos && (
        <div
          ref={panelRef}
          style={{ position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
          className="z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-xl flex flex-col"
        >
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (filtered.length > 0 && query.trim()) choose(filtered[0].value)
              } else if (e.key === 'Escape') {
                setOpen(false)
              }
            }}
            placeholder="พิมพ์รหัสหรือชื่อเพื่อค้นหา..."
            className="px-3 py-2 bg-slate-800 border-b border-slate-700 text-white text-sm focus:outline-none rounded-t-lg"
          />
          <div className="overflow-y-auto" style={{ maxHeight: pos.listMax }}>
            <button
              type="button"
              onClick={() => choose('')}
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
                  onClick={() => choose(o.value)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 ${String(o.value) === String(value) ? 'text-teal-400' : 'text-white'}`}
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
