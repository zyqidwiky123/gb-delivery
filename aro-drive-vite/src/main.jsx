import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

function showUpdatePopup(updateSW) {
  const existing = document.getElementById('sw-update-popup')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.id = 'sw-update-popup'
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:99999;'

  const box = document.createElement('div')
  box.style.cssText = 'background:#111;border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:32px;max-width:360px;width:90%;text-align:center;'

  box.innerHTML = `
    <div style="font-size:48px;margin-bottom:16px;">🔄</div>
    <h2 style="color:white;font-size:18px;font-weight:bold;margin:0 0 8px;">Update Tersedia</h2>
    <p style="color:#9CA3AF;font-size:13px;margin:0 0 24px;line-height:1.5;">
      Versi baru ARO DRIVE tersedia. Perbarui sekarang untuk pengalaman terbaik.
    </p>
    <button id="sw-update-btn" style="background:#CAFD00;color:#0A0A0A;border:none;border-radius:12px;padding:12px 32px;font-size:13px;font-weight:bold;cursor:pointer;width:100%;">
      Perbarui Sekarang
    </button>
  `

  overlay.appendChild(box)
  document.body.appendChild(overlay)

  document.getElementById('sw-update-btn').onclick = () => {
    overlay.remove()
    updateSW(true)
    window.location.reload()
  }
}

const updateSW = registerSW({
  onNeedRefresh() {
    showUpdatePopup(updateSW)
  },
  onRegistered(registration) {
    if (!registration) return
    registration.update()
    setInterval(() => registration.update(), 30 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update()
    })
    window.addEventListener('pageshow', () => registration.update())
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
