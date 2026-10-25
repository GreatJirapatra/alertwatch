import { useEffect, useState } from 'react'

// ปุ่มติดตั้งแอป: Chrome/Edge/Android ใช้ beforeinstallprompt, iOS Safari แสดงวิธี Add to Home Screen
// ซ่อนอัตโนมัติเมื่อเปิดจากแอปที่ติดตั้งแล้ว
export function InstallButton() {
  const [promptEvent, setPromptEvent] = useState(null)
  const [installed, setInstalled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  })
  const [showIos, setShowIos] = useState(false)

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setPromptEvent(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent)

  if (promptEvent) {
    return (
      <button
        onClick={async () => {
          promptEvent.prompt()
          await promptEvent.userChoice
          setPromptEvent(null)
        }}
        className="text-xs text-teal-400 hover:text-teal-300 transition mr-3"
      >
        ติดตั้งแอป
      </button>
    )
  }

  if (isIos) {
    return (
      <>
        <button onClick={() => setShowIos((v) => !v)} className="text-xs text-teal-400 hover:text-teal-300 transition mr-3">
          ติดตั้งแอป
        </button>
        {showIos && (
          <div className="absolute right-4 top-14 z-20 max-w-xs p-3 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 shadow-xl">
            ใน Safari กดปุ่มแชร์ (สี่เหลี่ยมมีลูกศรขึ้น) แล้วเลือก “เพิ่มไปยังหน้าจอโฮม” (Add to Home Screen)
          </div>
        )}
      </>
    )
  }
  return null
}
