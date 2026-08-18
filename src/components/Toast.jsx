import { useEffect } from 'react'

// Toast ลอยขึ้นมาจากด้านล่างจอ แสดงชั่วคราวแล้วหายไปเอง
// ใช้คู่กับ useToast hook ด้านล่าง
export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onClose, 2500)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  const isError = toast.type === 'error'

  return (
    <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-50 pointer-events-none">
      <div
        className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border animate-toast-in ${
          isError
            ? 'bg-red-500/95 border-red-400 text-white'
            : 'bg-teal-500/95 border-teal-400 text-white'
        }`}
      >
        {isError ? (
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
        <span className="text-sm font-medium">{toast.text}</span>
      </div>
    </div>
  )
}
