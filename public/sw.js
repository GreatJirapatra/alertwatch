// Service worker ของ AlertWatch — ทำให้ติดตั้งเป็นแอปได้ และเปิดหน้าโครงแอปได้แม้สัญญาณหลุด
// หลักการ: ข้อมูลจริงมาจาก Supabase เสมอ ไม่แคชคำขอข้ามโดเมน (ไม่เก็บ API/ข้อมูลร้าน/token ไว้ในเครื่อง)
// - หน้า (navigation): ขอจากเน็ตก่อน เพื่อให้ได้เวอร์ชันล่าสุดจาก Vercel ทันที; เน็ตหลุดค่อยใช้ของที่เก็บไว้
// - ไฟล์ใน /assets/ (ชื่อมี hash เปลี่ยนทุกครั้งที่ deploy): ใช้แคชก่อน
const VERSION = 'alertwatch-v1'
const SHELL = '/'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.add(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase และโดเมนอื่น ปล่อยผ่านตามปกติ

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(VERSION).then((c) => c.put(SHELL, copy))
          }
          return res
        })
        .catch(() => caches.match(SHELL).then((r) => r || Response.error())),
    )
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(VERSION).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
