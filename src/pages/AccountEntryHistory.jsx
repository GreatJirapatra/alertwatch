import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Select, Input } from '../components/FormFields'
import { ConfirmDeleteButton } from '../components/ConfirmDeleteButton'

const DIRECTION_OPTIONS = [
  { value: 'expense', label: 'รายจ่าย (-)' },
  { value: 'income', label: 'รายรับ (+)' },
]

const PAGE_SIZE = 20

export default function AccountEntryHistory({ onToast }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    loadPage(0, true)
  }, [])

  async function loadPage(offset, replace) {
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)

    const { data, error } = await supabase
      .from('account_entries')
      .select('id, entry_date, description, amount, direction, category, note')
      .order('entry_date', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      onToast?.({ type: 'error', text: 'โหลดประวัติไม่สำเร็จ: ' + error.message })
      setLoading(false)
      setLoadingMore(false)
      return
    }

    setRows((prev) => (replace ? data || [] : [...prev, ...(data || [])]))
    setHasMore((data || []).length === PAGE_SIZE)
    setLoading(false)
    setLoadingMore(false)
  }

  function startEdit(row) {
    setEditingId(row.id)
    setDraft({
      entry_date: row.entry_date,
      description: row.description,
      amount: String(row.amount),
      direction: row.direction,
      category: row.category || '',
      note: row.note || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(null)
  }

  async function saveEdit(id) {
    if (!draft.description.trim() || draft.amount === '') {
      onToast?.({ type: 'error', text: 'กรุณาใส่รายละเอียดและจำนวนเงิน' })
      return
    }
    setSavingId(id)
    const { error } = await supabase
      .from('account_entries')
      .update({
        entry_date: draft.entry_date,
        description: draft.description.trim(),
        amount: Math.abs(Number(draft.amount)),
        direction: draft.direction,
        category: draft.category.trim() || null,
        note: draft.note.trim() || null,
      })
      .eq('id', id)

    if (error) {
      onToast?.({ type: 'error', text: 'บันทึกไม่สำเร็จ: ' + error.message })
    } else {
      onToast?.({ type: 'ok', text: 'แก้ไขรายการแล้ว' })
      cancelEdit()
      loadPage(0, true)
    }
    setSavingId(null)
  }

  async function handleDelete(id) {
    setDeletingId(id)
    const { error } = await supabase.from('account_entries').delete().eq('id', id)
    if (error) {
      onToast?.({ type: 'error', text: 'ลบไม่สำเร็จ: ' + error.message })
    } else {
      onToast?.({ type: 'ok', text: 'ลบรายการแล้ว' })
      setRows((prev) => prev.filter((r) => r.id !== id))
    }
    setDeletingId(null)
  }

  if (loading) return <p className="text-slate-500 text-sm">กำลังโหลด...</p>

  if (rows.length === 0) {
    return <p className="text-slate-500 text-sm bg-slate-800/50 rounded-lg p-3">ยังไม่มีรายการ</p>
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const isEditing = editingId === row.id
        const isIncome = row.direction === 'income'
        return (
          <div key={row.id} className="bg-slate-800 rounded-lg border border-slate-700 p-3">
            {isEditing ? (
              <div className="space-y-2">
                <Select
                  label="ประเภท"
                  value={draft.direction}
                  onChange={(v) => setDraft((d) => ({ ...d, direction: v }))}
                  options={DIRECTION_OPTIONS}
                />
                <Input
                  label="รายละเอียด"
                  type="text"
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="จำนวนเงิน (บาท)"
                    type="number"
                    step="0.01"
                    value={draft.amount}
                    onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                  />
                  <Input
                    label="วันที่"
                    type="date"
                    value={draft.entry_date}
                    onChange={(e) => setDraft((d) => ({ ...d, entry_date: e.target.value }))}
                  />
                </div>
                <Input
                  label="หมวดหมู่"
                  type="text"
                  value={draft.category}
                  onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                />
                <Input
                  label="หมายเหตุ"
                  type="text"
                  value={draft.note}
                  onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => saveEdit(row.id)}
                    disabled={savingId === row.id}
                    className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    {savingId === row.id ? 'กำลังบันทึก...' : 'บันทึก'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{row.description}</span>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded ${isIncome ? 'bg-teal-500/20 text-teal-400' : 'bg-red-500/20 text-red-400'}`}>
                      {isIncome ? '+' : '-'}{Number(row.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {row.entry_date}
                    {row.category && ` · ${row.category}`}
                  </p>
                  {row.note && <p className="text-xs text-slate-500 mt-0.5">{row.note}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(row)}
                    className="text-xs px-2 py-1 rounded text-teal-400/80 hover:text-teal-400 hover:bg-teal-500/10 transition"
                  >
                    แก้ไข
                  </button>
                  <ConfirmDeleteButton onConfirm={() => handleDelete(row.id)} busy={deletingId === row.id} />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {hasMore && (
        <button
          onClick={() => loadPage(rows.length, false)}
          disabled={loadingMore}
          className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm transition disabled:opacity-50"
        >
          {loadingMore ? 'กำลังโหลด...' : 'โหลดเพิ่ม'}
        </button>
      )}
    </div>
  )
}
