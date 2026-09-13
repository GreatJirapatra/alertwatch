import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Select, Input } from '../components/FormFields'

const DIRECTION_OPTIONS = [
  { value: 'expense', label: 'รายจ่าย (-)' },
  { value: 'income', label: 'รายรับ (+)' },
]

export default function AccountEntryForm({ onDone, onToast }) {
  const { user } = useAuth()
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState('expense')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setMsg(null)

    if (!description.trim() || amount === '') {
      setMsg({ type: 'err', text: 'กรุณาใส่รายละเอียดและจำนวนเงิน' })
      return
    }

    setBusy(true)
    const { error } = await supabase.from('account_entries').insert({
      entry_date: entryDate,
      description: description.trim(),
      amount: Math.abs(Number(amount)),
      direction,
      category: category.trim() || null,
      note: note.trim() || null,
      created_by: user?.id ?? null,
    })

    if (error) {
      setMsg({ type: 'err', text: error.message })
      onToast?.({ type: 'error', text: 'บันทึกไม่สำเร็จ: ' + error.message })
    } else {
      setMsg(null)
      setDescription('')
      setAmount('')
      setCategory('')
      setNote('')
      onDone?.()
      onToast?.({ type: 'ok', text: 'บันทึกรายการบัญชีแล้ว' })
    }
    setBusy(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h3 className="text-sm font-semibold text-slate-200">คีย์รายรับ-รายจ่ายบริษัท</h3>
      <p className="text-xs text-slate-500">
        สำหรับรายการที่ไม่เกี่ยวกับการขายสินค้าโดยตรง เช่น ค่าเช่า เงินเดือน ค่าน้ำไฟ ค่าธรรมเนียมธนาคาร
      </p>

      <Select
        label="ประเภท"
        value={direction}
        onChange={setDirection}
        options={DIRECTION_OPTIONS}
      />

      <Input
        label="รายละเอียด"
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="เช่น ค่าเช่าโกดัง เดือนกันยายน"
      />

      <Input
        label="จำนวนเงิน (บาท)"
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="เช่น 8500"
      />

      <Input
        label="วันที่"
        type="date"
        value={entryDate}
        onChange={(e) => setEntryDate(e.target.value)}
      />

      <Input
        label="หมวดหมู่ (ถ้ามี)"
        type="text"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="เช่น ค่าเช่า, เงินเดือน, สาธารณูปโภค"
      />

      <Input
        label="หมายเหตุ (ถ้ามี)"
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {msg && <p className="text-sm text-red-400">{msg.text}</p>}

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
