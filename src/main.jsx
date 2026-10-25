import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ดักสัญญาณติดตั้งแอปตั้งแต่เริ่มโหลด (Chrome ยิงครั้งเดียวก่อนที่ปุ่มจะถูกสร้าง)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__pwaPrompt = e
  window.dispatchEvent(new Event('pwa-prompt-ready'))
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ลงทะเบียน service worker (เฉพาะตอน build จริง) เพื่อให้ติดตั้งเป็นแอปได้
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
