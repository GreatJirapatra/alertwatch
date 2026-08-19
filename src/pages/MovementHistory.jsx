import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Select, Input } from '../components/FormFields'
import { SearchableSelect } from '../components/SearchableSelect'
import { ConfirmDeleteButton } from '../components/ConfirmDeleteButton'

const KIND_OPTIONS = [
  { value: 'in', label: 'รับเข้า' },
  { value: 'out', label: 'ขายออก' },
  { value: 'return', label: 'ตีกลับ' },
  { value: 'adjust', label: 'ปรับปรุงยอด' },
]
const KIND_LABEL = Object.fromEntries(KIND_OPTIONS.map((k) => [k.value, k.label]))

const PAGE_SIZE = 20

export default function MovementHistory({ onToast }) {
  const [skus, setSkus] = useState([])
  const [stores, setStores] = useState([])
  const [provinces, setProvinces] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    supabase.from('skus').select('id, code, name').order('code').then(({ data }) => setSkus(data || []))
    supabase.from('stores').select('id, name, kind').order('kind').order('name').then(({ data }) => setStores(data || []))
    supabase.from('provinces').select('name').order('name').then(({ data }) => setProvinces(data || []))
    loadPage(0, true)
  }, [])

  // โหลดรายการ + เช็คว่ารายการ "ขายออก" ไหนผูก order_no กับ payout ที่รับเงินแล้วบ้าง
  // (ไว้เตือนก่อนลบ เพราะลบแล้วจะกระทบตัวเลขกำไรขาดทุน)
  async function loadPage(offset, replace) {
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)

    const { data, error } = await supabase
      .from('movements')
      .select('id, sku_id, store_id, kind, qty, moved_on, order_no, customer_province, note, created_at, skus(code, name), stores(name, kind)')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      onToast?.({ type: 'error', text: 'โหลดประวัติไม่สำเร็จ: ' + error.message })
      setLoading(false)
      setLoadingMore(false)
      return
    }

    const orderNos = [...new Set((data || []).filter((m) => m.kind === 'out' && m.order_no).map((m) => m.order_no))]
    let linkedSet = new Set()
    if (orderNos.length > 0) {
      const { data: payoutRows } = await supabase.from('payouts').select('order_no').in('order_no', orderNos)
      linkedSet = new Set((payoutRows || []).map((p) => p.order_no))
    }
    const withFlag = (data || []).map((m) => ({ ...m, payoutLinked: m.order_no ? linkedSet.has(m.order_no) : false }))

    setRows((prev) => (replace ? withFlag : [...prev, ...withFlag]))
    setHasMore((data || []).length === PAGE_SIZE)
    setLoading(false)
    setLoadingMore(false)
  }

  function startEdit(row) {
    setEditingId(row.id)
    setDraft({
      sku_id: row.sku_id,
      store_id: row.store_id ?? '',
      kind: row.kind,
      qty: String(row.qty),
      moved_on: row.moved_on,
      order_no: row.order_no || '',
      customer_province: row.customer_province || '',
      note: row.note || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(null)
  }

  async function saveEdit(id) {
    if (!draft.sku_id || draft.qty === '' || Number(draft.qty) === 0) {
      onToast?.({ type: 'error', text: 'กรุณาเลือกสินค้าและใส่จำนวน (ไม่เป็น 0)' })
      return
    }
    setSavingId(id)
    const { error } = await supabase
      .from('movements')
      .update({
        sku_id: draft.sku_id,
        store_id: draft.store_id || null,
        kind: draft.kind,
        qty: Number(draft.qty),
        moved_on: draft.moved_on,
        order_no: draft.order_no || null,
        customer_province: draft.customer_province || null,
        note: draft.note || null,
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
    const { error } = await supabase.from('movements').delete().eq('id', id)
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
                  label="สินค้า"
                  value={draft.sku_id}
                  onChange={(v) => setDraft((d) => ({ ...d, sku_id: v }))}
                  options={skus.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    label="ประเภท"
                    value={draft.kind}
                    onChange={(v) => setDraft((d) => ({ ...d, kind: v }))}
                    options={KIND_OPTIONS}
                  />
                  <Input
                    label="จำนวน (+/-)"
                    type="number"
                    step="1"
                    value={draft.qty}
                    onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))}
                  />
                </div>
                <Select
                  label="ร้าน (เว้นว่าง = คลังกลาง)"
                  value={draft.store_id}
                  onChange={(v) => setDraft((d) => ({ ...d, store_id: v }))}
                  placeholder="คลังกลาง"
                  options={stores.map((s) => ({ value: s.id, label: `${s.name} (${s.kind === 'own' ? 'ตัวเอง' : 'เพื่อน'})` }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="วันที่"
                    type="date"
                    value={draft.moved_on}
                    onChange={(e) => setDraft((d) => ({ ...d, moved_on: e.target.value }))}
                  />
                  <Input
                    label="เลขที่ออเดอร์"
                    type="text"
                    value={draft.order_no}
                    onChange={(e) => setDraft((d) => ({ ...d, order_no: e.target.value }))}
                  />
                </div>
                <SearchableSelect
                  label="จังหวัดลูกค้า"
                  value={draft.customer_province}
                  onChange={(v) => setDraft((d) => ({ ...d, customer_province: v }))}
                  placeholder="ไม่ระบุ"
                  options={provinces.map((p) => ({ value: p.name, label: p.name }))}
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
                    <span className="text-sm font-medium">{row.skus?.code} — {row.skus?.name}</span>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded ${row.kind === 'out' ? 'bg-red-500/20 text-red-400' : 'bg-teal-500/20 text-teal-400'}`}>
                      {KIND_LABEL[row.kind]} {row.qty > 0 ? `+${row.qty}` : row.qty}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {row.moved_on} · {row.stores?.name || 'คลังกลาง'}
                    {row.order_no && ` · ${row.order_no}`}
                    {row.customer_province && ` · จ.${row.customer_province}`}
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
                  <ConfirmDeleteButton
                    onConfirm={() => handleDelete(row.id)}
                    busy={deletingId === row.id}
                    warning={row.payoutLinked ? '⚠ ผูกกับยอดเงินที่รับแล้ว จะกระทบกำไรขาดทุน' : null}
                  />
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
