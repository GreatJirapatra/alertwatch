import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName || email.split('@')[0] } },
      })
      if (error) {
        setError(error.message)
      } else {
        setInfo('สมัครสำเร็จ — ถ้าระบบขอยืนยันอีเมล ให้เช็คกล่องจดหมาย ไม่งั้น login ได้เลย')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setBusy(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-700">
        <h1 className="text-2xl font-bold text-white mb-1">AlertWatch</h1>
        <p className="text-slate-400 text-sm mb-6">ระบบบริหารร้านค้าออนไลน์</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="text-xs text-slate-400">ชื่อที่แสดง</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-teal-500"
                placeholder="เกรท"
              />
            </div>
          )}
          <div>
            <label className="text-xs text-slate-400">อีเมล</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-teal-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">รหัสผ่าน</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-teal-500"
              placeholder="อย่างน้อย 6 ตัวอักษร"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {info && <p className="text-teal-400 text-sm">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition disabled:opacity-50"
          >
            {busy ? 'กำลังทำรายการ...' : mode === 'signup' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setInfo('') }}
          className="w-full mt-4 text-xs text-slate-400 hover:text-teal-400 transition"
        >
          {mode === 'signup' ? 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สมัครสมาชิก'}
        </button>
      </div>
    </div>
  )
}
