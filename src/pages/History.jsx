import { useState } from 'react'
import MovementHistory from './MovementHistory'
import PayoutHistory from './PayoutHistory'
import AdsSpendHistory from './AdsSpendHistory'
import { Toast } from '../components/Toast'

const TABS = [
  { key: 'movement', label: 'สต๊อก' },
  { key: 'payout', label: 'ยอดเงิน' },
  { key: 'ads', label: 'ค่าโฆษณา' },
]

export default function History({ onBack }) {
  const [tab, setTab] = useState('movement')
  const [toast, setToast] = useState(null)

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-4 flex items-center gap-3 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <button onClick={onBack} className="text-slate-400 hover:text-teal-400 transition text-sm">
          ← กลับ
        </button>
        <h1 className="text-lg font-bold">ประวัติรายการ</h1>
      </header>

      <div className="px-4 pt-4 flex gap-2 max-w-md mx-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key
                ? 'bg-teal-600 text-white'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="p-4 max-w-md mx-auto">
        <p className="text-xs text-slate-500 mb-3">
          รายการล่าสุดขึ้นก่อน แก้ไขหรือลบรายการที่คีย์ผิดได้ตรงนี้
        </p>
        {tab === 'movement' && <MovementHistory onToast={setToast} />}
        {tab === 'payout' && <PayoutHistory onToast={setToast} />}
        {tab === 'ads' && <AdsSpendHistory onToast={setToast} />}
      </main>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
