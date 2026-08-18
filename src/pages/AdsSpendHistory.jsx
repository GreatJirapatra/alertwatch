import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Select, Input } from '../components/FormFields'
import { ConfirmDeleteButton } from '../components/ConfirmDeleteButton'

const PAGE_SIZE = 20

export default function AdsSpendHistory({ onToast }) {
  const [stores, setStores] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    supabase.from('stores').select('id, name, kind').order('kind').order('name').then(({ data }) => setStores(data || []))
    loadPage(0, true)
  }, [])

  async function loadPage(offset, replace) {
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)

    const { data, error } = await supabase
      .from('ads_spend')
      .select('id, store_id, period_month, amount, created_at, stores(name, kind)')
      .order('created_at', { ascending: false })
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
      store_id: row.store_id,
      period_month: row.period_month,
      amount: String(row.amount),
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(null)
  }

  async function saveEdit(id) {
    if (!draft.store_id || draft.amount === '') {
      onToast?.({ type: 'error', text: 'กรุณาเลือกร้านและใส่ยอดค่าโฆษณา' })
      return
    }
    setSavingId(id)
    const { error } = await supabase
      .from('ads_spend')
      .update({
        store_id: draft.store_id,
        period_month: draft.period_month,
        amount: Number(draft.amount),
      })
      .eq('id', id)

    if (error) {
      // ชนกับ unique constraint (store_id, period_month) ถ้าเดือน/ร้านซ้ำกับรายการอื่น
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
    const { error } = await supabase.from('ads_spend').delete().eq('id', id)
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
        return (
          <div key={row.id} className="bg-slate-800 rounded-lg border border-slate-700 p-3">
            {isEditing ? (
              <div className="space-y-2">
                <Select
                  label="ร้าน"
                  value={draft.store_id}
                  onChange={(v) => setDraft((d) => ({ ...d, store_id: v }))}
                  options={stores.map((s) => ({ value: s.id, label: `${s.name} (${s.kind === 'own' ? 'ตัวเอง' : 'เพื่อน'})` }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="เดือน"
                    type="month"
                    value={draft.period_month.slice(0, 7)}
                    onChange={(e) => setDraft((d) => ({ ...d, period_month: e.target.value + '-01' }))}
                  />
                  <Input
                    label="ยอดค่าโฆษณา (บาท)"
                    type="number"
                    step="0.01"
                    value={draft.amount}
                    onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                  />
                </div>
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
                    <span className="text-sm font-medium">{row.stores?.name}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400">
                      {Number(row.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(row.period_month).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })}
                  </p>
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
