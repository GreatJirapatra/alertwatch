import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Select, Input } from '../components/FormFields'

export default function PayoutForm({ onDone }) {
  const [stores, setStores] = useState([])
  const [storeId, setStoreId] = useState('')
  const [settledOn, setSettledOn] = useState(new Date().toISOString().slice(0, 10))
  const [orderNo, setOrderNo] = useState('')
  const [grossPrice, setGrossPrice] = useState('')
  const [actualAmount, setActualAmount] = useState('')
  const [batchRef, setBatchRef] = useState('')
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

    if (!storeId || !actualAmount) {
      setMsg({ type: 'err', text: 'กรุณาเลือกร้านและใส่ยอดเงินที่ได้รับจริง' })
      return
    }

    setBusy(true)
    const { error } = await supabase.from('payouts').insert({
      store_id: storeId,
      settled_on: settledOn,
      order_no: orderNo || null,
      gross_price: grossPrice ? Number(grossPrice) : null,
      actual_amount: Number(actualAmount),
      batch_ref: batchRef || null,
      note: note || null,
    })

    if (error) {
      setMsg({ type: 'err', text: error.message })
    } else {
      setMsg({ type: 'ok', text: 'บันทึกแล้ว' })
      setOrderNo('')
      setGrossPrice('')
      setActualAmount('')
      setBatchRef('')
      setNote('')
      onDone?.()
    }
    setBusy(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h3 className="text-sm font-semibold text-slate-200">คีย์ยอดเงินที่ได้รับจริง</h3>

      <Select
        label="ร้าน"
        value={storeId}
        onChange={setStoreId}
        placeholder="เลือกร้าน"
        options={stores.map((s) => ({ value: s.id, label: `${s.name} (${s.kind === 'own' ? 'ตัวเอง' : 'เพื่อน'})` }))}
      />

      <Input
        label="วันที่ settlement"
        type="date"
        value={settledOn}
        onChange={(e) => setSettledOn(e.target.value)}
      />

      <Input
        label="เลขที่ออเดอร์ (ถ้ามี)"
        type="text"
        value={orderNo}
        onChange={(e) => setOrderNo(e.target.value)}
        placeholder="เช่น MM-1023"
      />

      <Input
        label="ราคาที่ลูกค้าจ่าย (ถ้ารู้)"
        type="number"
        step="0.01"
        value={grossPrice}
        onChange={(e) => setGrossPrice(e.target.value)}
        placeholder="เช่น 2199"
      />

      <Input
        label="เงินเข้าจริง (หัก fee แล้ว)"
        type="number"
        step="0.01"
        value={actualAmount}
        onChange={(e) => setActualAmount(e.target.value)}
        placeholder="เช่น 1500.50"
      />

      <Input
        label="Batch reference (ถ้ามี)"
        type="text"
        value={batchRef}
        onChange={(e) => setBatchRef(e.target.value)}
      />

      <Input
        label="หมายเหตุ (ถ้ามี)"
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
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
