import { useEffect, useState } from 'react'

// ปุ่มติดตั้งแอป: Chrome/Edge/Android ใช้ beforeinstallprompt, iOS Safari แสดงวิธี Add to Home Screen
// ซ่อนอัตโนมัติเมื่อเปิดจากแอปที่ติดตั้งแล้ว
// เปิดโหมดตรวจสอบโดยใส่ ?pwa-debug ท้าย URL — แสดงผลเช็คความพร้อมติดตั้ง (service worker, manifest, ไอคอน)
function PwaDebug({ gotPrompt }) {
  const [lines, setLines] = useState(['กำลังตรวจ...'])
  useEffect(() => {
    let alive = true
    ;(async () => {
      const out = []
      const add = (k, v) => out.push(`${k}: ${v}`)
      try {
        add('https', window.isSecureContext)
        add('standalone', window.matchMedia('(display-mode: standalone)').matches)
        add('beforeinstallprompt', gotPrompt ? 'ได้รับแล้ว' : 'ยังไม่ได้รับ')
        add('SW รองรับ', 'serviceWorker' in navigator)
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations()
          add('SW ลงทะเบียน', regs.length ? regs.map((r) => (r.active ? 'active' : r.installing ? 'installing' : 'waiting') + ' ' + r.scope).join(', ') : 'ไม่มี')
          add('SW คุมหน้านี้', !!navigator.serviceWorker.controller)
        }
        const link = document.querySelector('link[rel="manifest"]')
        add('manifest link', link ? link.href : 'ไม่พบ')
        if (link) {
          const r = await fetch(link.href)
          add('manifest HTTP', `${r.status} ${r.headers.get('content-type')}`)
          const m = await r.json()
          add('manifest', `${m.name} | ${m.display} | start ${m.start_url}`)
          for (const ic of m.icons || []) {
            const ir = await fetch(ic.src)
            const b = await ir.blob()
            const bmp = await createImageBitmap(b).catch(() => null)
            add(`icon ${ic.sizes} ${ic.purpose}`, `${ir.status} ${b.type} ${bmp ? bmp.width + 'x' + bmp.height : 'อ่านรูปไม่ได้'}`)
          }
        }
        add('UA', navigator.userAgent)
      } catch (e) {
        add('error', String(e))
      }
      if (alive) setLines(out)
    })()
    return () => {
      alive = false
    }
  }, [gotPrompt])
  return (
    <pre className="fixed inset-0 z-[1000] overflow-auto p-4 bg-black text-xs text-teal-200 whitespace-pre-wrap break-all">
      {lines.join('\n')}
    </pre>
  )
}

export function InstallButton() {
  const [promptEvent, setPromptEvent] = useState(() => (typeof window !== 'undefined' ? window.__pwaPrompt || null : null))
  const [installed, setInstalled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  })
  const [showIos, setShowIos] = useState(false)

  useEffect(() => {
    const onPrompt = () => setPromptEvent(window.__pwaPrompt || null)
    const onInstalled = () => {
      setInstalled(true)
      window.__pwaPrompt = null
      setPromptEvent(null)
    }
    window.addEventListener('pwa-prompt-ready', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('pwa-prompt-ready', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const debug = typeof window !== 'undefined' && window.location.search.includes('pwa-debug')
  if (debug) return <PwaDebug gotPrompt={!!promptEvent} />
  if (installed) return null
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent)

  if (promptEvent) {
    return (
      <button
        onClick={async () => {
          promptEvent.prompt()
          await promptEvent.userChoice
          window.__pwaPrompt = null
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
