import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Select, Input } from '../components/FormFields'

export default function AdsSpendForm({ onDone }) {
  const [stores, setStores] = useState([])
  const [storeId, setStoreId] = useState('')
  const [periodMonth, setPeriodMonth] = useState(new Date().toISOString().slice(0, 7) + '-01')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase.from('stores').select('id, name, kind').eq('active', true).order('kind').order('name')
      .then(({ data }) => setStores(data || []))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setMsg(null)

    if (!storeId || !amount) {
      setMsg({ type: 'err', text: 'กรุณาเลือกร้านและใส่ยอดค่าโฆษณา' })
      return
    }

    setBusy(true)
    // upsert เพราะมี unique constraint (store_id, period_month) — คีย์ซ้ำเดือนเดิมจะอัปเดตทับ
    const { error } = await supabase.from('ads_spend').upsert(
      { store_id: storeId, period_month: periodMonth, amount: Number(amount) },
      { onConflict: 'store_id,period_month' }
    )

    if (error) {
      setMsg({ type: 'err', text: error.message })
    } else {
      setMsg({ type: 'ok', text: 'บันทึกแล้ว (ถ้ามีของเดือนนี้อยู่แล้วจะถูกอัปเดตทับ)' })
      setAmount('')
      onDone?.()
    }
    setBusy(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h3 className="text-sm font-semibold text-slate-200">คีย์ค่าโฆษณารายเดือน</h3>

      <Select
        label="ร้าน"
        value={storeId}
        onChange={setStoreId}
        placeholder="เลือกร้าน"
        options={stores.map((s) => ({ value: s.id, label: `${s.name} (${s.kind === 'own' ? 'ตัวเอง' : 'เพื่อน'})` }))}
      />

      <Input
        label="เดือน"
        type="month"
        value={periodMonth.slice(0, 7)}
        onChange={(e) => setPeriodMonth(e.target.value + '-01')}
      />

      <Input
        label="ยอดค่าโฆษณา (บาท)"
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="เช่น 3500"
      />

      {msg && (
        <p className={`text-sm ${msg.type === 'ok' ? 'text-teal-400' : 'text-red-400'}`}>{msg.text}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition disabled:opacity-50"
      >
        {busy ? 'กำลังบันทึก...' : 'บันทึกรายการ'}
      </button>
    </form>
  )
}
