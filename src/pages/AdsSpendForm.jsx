import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Select, Input } from '../components/FormFields'

// หาวันเสาร์ล่าสุด (หรือวันนี้ถ้าเป็นเสาร์อยู่แล้ว) ไว้ตั้งค่าเริ่มต้นของ "สัปดาห์ที่สิ้นสุดวันที่"
function lastSaturday() {
  const d = new Date()
  const day = d.getDay() // 0=อาทิตย์ ... 6=เสาร์
  const diff = (day + 1) % 7 // จำนวนวันย้อนไปหาเสาร์ล่าสุด
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

export default function AdsSpendForm({ onDone, onToast }) {
  const [stores, setStores] = useState([])
  const [storeId, setStoreId] = useState('')
  const [weekEnding, setWeekEnding] = useState(lastSaturday())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
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
    // upsert เพราะมี unique constraint (store_id, week_ending) — คีย์ซ้ำสัปดาห์เดิมจะอัปเดตทับ (ไว้แก้ไขยอดย้อนหลังได้)
    const { error } = await supabase.from('ads_spend_weekly').upsert(
      { store_id: storeId, week_ending: weekEnding, amount: Number(amount), note: note || null },
      { onConflict: 'store_id,week_ending' }
    )

    if (error) {
      setMsg({ type: 'err', text: error.message })
      onToast?.({ type: 'error', text: 'บันทึกไม่สำเร็จ: ' + error.message })
    } else {
      setMsg(null)
      setAmount('')
      setNote('')
      onDone?.()
      onToast?.({ type: 'ok', text: 'บันทึกค่าโฆษณาแล้ว' })
    }
    setBusy(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h3 className="text-sm font-semibold text-slate-200">คีย์ค่าโฆษณารายสัปดาห์</h3>

      <Select
        label="ร้าน"
        value={storeId}
        onChange={setStoreId}
        placeholder="เลือกร้าน"
        options={stores.map((s) => ({ value: s.id, label: `${s.name} (${s.kind === 'own' ? 'ตัวเอง' : 'เพื่อน'})` }))}
      />

      <Input
        label="สัปดาห์ที่สิ้นสุดวันที่"
        type="date"
        value={weekEnding}
        onChange={(e) => setWeekEnding(e.target.value)}
      />

      <Input
        label="ยอดค่าโฆษณาสัปดาห์นี้ (บาท)"
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="เช่น 850"
      />

      <Input
        label="หมายเหตุ (ถ้ามี)"
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {msg && (
        <p className="text-sm text-red-400">{msg.text}</p>
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
