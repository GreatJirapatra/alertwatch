import { useState } from 'react'

// ปุ่มลบแบบ 2 ขั้นตอน — กันมือลื่นกดลบพลาดบนมือถือ
// กดครั้งแรกจะเปลี่ยนเป็นปุ่ม "ยืนยันลบ" + "ยกเลิก" แทน ต้องกดยืนยันอีกที
export function ConfirmDeleteButton({ onConfirm, busy, warning }) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        {warning && <span className="text-[11px] text-yellow-400 basis-full text-right">{warning}</span>}
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-medium transition disabled:opacity-50"
        >
          {busy ? 'กำลังลบ...' : 'ยืนยันลบ'}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-xs px-2 py-1 rounded text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition"
    >
      ลบ
    </button>
  )
}
