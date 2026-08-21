import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Select, Input } from '../components/FormFields'
import { ConfirmDeleteButton } from '../components/ConfirmDeleteButton'
import { Toast } from '../components/Toast'

function toNum(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

// สูตรเดียวกับหน้า "เครื่องคำนวณราคาขาย" — ต้นทุนหน้าคลัง (แปลงสกุลเงินเป็นบาท) + ราคาขายที่ควรตั้งให้ได้มาร์จิ้นเป้าหมาย
function computePricing({ cost_currency, cost_amount, fx_rate, shipping_per_unit, fee_pct, ads_pct, affiliate_pct, affiliate_attach, target_margin }) {
  const landed = cost_currency === 'THB'
    ? toNum(cost_amount) + toNum(shipping_per_unit)
    : toNum(cost_amount) * toNum(fx_rate, 1) + toNum(shipping_per_unit)

  const fee = toNum(fee_pct) / 100
  const ads = toNum(ads_pct) / 100
  const aff = toNum(affiliate_pct) / 100
  const attach = toNum(affiliate_attach) / 100
  const target = toNum(target_margin) / 100
  const affExpected = aff * attach

  const denom = 1 - fee - ads - affExpected - target
  const suggested = denom > 0 ? landed / denom : null

  return { landed, suggested }
}

const CURRENCY_OPTIONS = [
  { value: 'THB', label: 'บาท (THB)' },
  { value: 'RMB', label: 'หยวน (RMB)' },
  { value: 'USD', label: 'ดอลลาร์ (USD)' },
]

function PricingPreview({ draft }) {
  const { landed, suggested } = computePricing(draft)
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
        <p className="text-[11px] text-slate-500">ต้นทุนหน้าคลัง/ชิ้น</p>
        <p className="text-lg font-bold mt-0.5">฿{landed.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</p>
      </div>
      <div className="bg-teal-500/10 rounded-lg p-3 border border-teal-500/30">
        <p className="text-[11px] text-teal-400">ราคาขายที่ควรตั้ง</p>
        <p className="text-lg font-bold text-teal-400 mt-0.5">
          {suggested ? `฿${suggested.toLocaleString('th-TH', { maximumFractionDigits: 0 })}` : '—'}
        </p>
      </div>
    </div>
  )
}

// ฟอร์มฟิลด์ต้นทุน+มาร์จิ้นชุดเดียวกัน ใช้ทั้งตอนเพิ่มใหม่และแก้ไข
function CostFields({ draft, setDraft }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Select label="สกุลเงินต้นทุน" value={draft.cost_currency} onChange={(v) => setDraft((d) => ({ ...d, cost_currency: v }))} options={CURRENCY_OPTIONS} />
        <Input
          label="ต้นทุนสินค้า/ชิ้น"
          type="number" step="0.01"
          value={draft.cost_amount}
          onChange={(e) => setDraft((d) => ({ ...d, cost_amount: e.target.value }))}
        />
      </div>
      {draft.cost_currency !== 'THB' && (
        <Input
          label={`เรทแลกเปลี่ยน (1 ${draft.cost_currency} = กี่บาท)`}
          type="number" step="0.01"
          value={draft.fx_rate}
          onChange={(e) => setDraft((d) => ({ ...d, fx_rate: e.target.value }))}
        />
      )}
      <Input
        label="ค่าขนส่งต่อชิ้น (บาท)"
        type="number" step="0.01"
        value={draft.shipping_per_unit}
        onChange={(e) => setDraft((d) => ({ ...d, shipping_per_unit: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="ค่าธรรมเนียมแพลตฟอร์ม (%) — ใช้ preview เท่านั้น"
          type="number" step="0.5"
          value={draft.fee_pct}
          onChange={(e) => setDraft((d) => ({ ...d, fee_pct: e.target.value }))}
        />
        <Input
          label="กำไรเป้าหมาย (%)"
          type="number" step="1"
          value={draft.target_margin}
          onChange={(e) => setDraft((d) => ({ ...d, target_margin: e.target.value }))}
        />
      </div>
      <PricingPreview draft={draft} />
    </>
  )
}

const emptyDraft = {
  code: '',
  name: '',
  category: '',
  cost_currency: 'THB',
  cost_amount: '',
  fx_rate: '5.0',
  shipping_per_unit: '0',
  current_price: '',
  competitor_price: '',
  ads_pct: '10',
  affiliate_pct: '0',
  affiliate_attach: '40',
  target_margin: '20',
  min_margin: '12',
  reorder_point: '10',
  fee_pct: '27',
  active: true,
}

export default function SkuManager({ onBack }) {
  const [skus, setSkus] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newDraft, setNewDraft] = useState(emptyDraft)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [filter, setFilter] = useState('all') // all | active | inactive

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('skus').select('*').order('active', { ascending: false }).order('code')
    if (error) setToast({ type: 'error', text: 'โหลดรายการไม่สำเร็จ: ' + error.message })
    setSkus(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startEdit(s) {
    setEditingId(s.id)
    setDraft({
      code: s.code || '',
      name: s.name,
      category: s.category || '',
      cost_currency: s.cost_currency,
      cost_amount: String(s.cost_amount),
      fx_rate: String(s.fx_rate),
      shipping_per_unit: String(s.shipping_per_unit),
      current_price: s.current_price ?? '',
      competitor_price: s.competitor_price ?? '',
      ads_pct: String(s.ads_pct * 100),
      affiliate_pct: String(s.affiliate_pct * 100),
      affiliate_attach: String(s.affiliate_attach * 100),
      target_margin: String(s.target_margin * 100),
      min_margin: String(s.min_margin * 100),
      reorder_point: String(s.reorder_point),
      fee_pct: '27',
      active: s.active,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(null)
  }

  async function saveEdit(id) {
    if (!draft.name || draft.cost_amount === '') {
      setToast({ type: 'error', text: 'กรุณาใส่ชื่อสินค้าและต้นทุน' })
      return
    }
    setSavingId(id)
    const payload = {
      code: draft.code || null,
      name: draft.name,
      category: draft.category || null,
      cost_currency: draft.cost_currency,
      cost_amount: toNum(draft.cost_amount),
      fx_rate: toNum(draft.fx_rate, 1),
      shipping_per_unit: toNum(draft.shipping_per_unit),
      current_price: draft.current_price === '' ? null : toNum(draft.current_price),
      competitor_price: draft.competitor_price === '' ? null : toNum(draft.competitor_price),
      ads_pct: toNum(draft.ads_pct) / 100,
      affiliate_pct: toNum(draft.affiliate_pct) / 100,
      affiliate_attach: toNum(draft.affiliate_attach) / 100,
      target_margin: toNum(draft.target_margin) / 100,
      min_margin: toNum(draft.min_margin) / 100,
      reorder_point: Math.round(toNum(draft.reorder_point, 10)),
      active: draft.active,
    }
    if (draft.competitor_price !== '') {
      payload.competitor_checked = new Date().toISOString().slice(0, 10)
    }
    const { error } = await supabase.from('skus').update(payload).eq('id', id)

    if (error) {
      setToast({ type: 'error', text: 'บันทึกไม่สำเร็จ: ' + error.message })
    } else {
      setToast({ type: 'ok', text: 'บันทึกข้อมูลสินค้าแล้ว' })
      cancelEdit()
      load()
    }
    setSavingId(null)
  }

  async function handleDelete(id) {
    setDeletingId(id)
    // ลบไม่ได้ถ้ามี movements อ้างถึง — แนะนำให้ตั้ง active=false แทนตามที่เคยคุยกันไว้
    const { error } = await supabase.from('skus').delete().eq('id', id)
    if (error) {
      setToast({ type: 'error', text: 'ลบไม่ได้ (น่าจะมีประวัติการขายผูกอยู่แล้ว) — ใช้ปิดการขายแทนดีกว่า: ' + error.message })
    } else {
      setToast({ type: 'ok', text: 'ลบ SKU แล้ว' })
      setSkus((prev) => prev.filter((s) => s.id !== id))
    }
    setDeletingId(null)
  }

  async function handleCreate() {
    if (!newDraft.code || !newDraft.name || newDraft.cost_amount === '') {
      setToast({ type: 'error', text: 'กรุณาใส่รหัสสินค้า ชื่อ และต้นทุน' })
      return
    }
    setCreating(true)
    const { error } = await supabase.from('skus').insert({
      code: newDraft.code,
      name: newDraft.name,
      category: newDraft.category || null,
      cost_currency: newDraft.cost_currency,
      cost_amount: toNum(newDraft.cost_amount),
      fx_rate: toNum(newDraft.fx_rate, 1),
      shipping_per_unit: toNum(newDraft.shipping_per_unit),
      current_price: newDraft.current_price === '' ? null : toNum(newDraft.current_price),
      ads_pct: toNum(newDraft.ads_pct) / 100,
      affiliate_pct: toNum(newDraft.affiliate_pct) / 100,
      affiliate_attach: toNum(newDraft.affiliate_attach) / 100,
      target_margin: toNum(newDraft.target_margin) / 100,
      min_margin: toNum(newDraft.min_margin) / 100,
      reorder_point: Math.round(toNum(newDraft.reorder_point, 10)),
      active: newDraft.active,
    })

    if (error) {
      setToast({ type: 'error', text: 'เพิ่มไม่สำเร็จ: ' + error.message })
    } else {
      setToast({ type: 'ok', text: 'เพิ่มสินค้าใหม่แล้ว' })
      setNewDraft(emptyDraft)
      setAdding(false)
      load()
    }
    setCreating(false)
  }

  const filtered = skus.filter((s) => {
    if (filter === 'active') return s.active
    if (filter === 'inactive') return !s.active
    return true
  })
  const missingCostCount = skus.filter((s) => !s.active && toNum(s.cost_amount) === 0).length

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-4 flex items-center gap-3 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <button onClick={onBack} className="text-slate-400 hover:text-teal-400 transition text-sm">
          ← กลับ
        </button>
        <h1 className="text-lg font-bold">จัดการสินค้า / ต้นทุน</h1>
      </header>

      <main className="p-4 space-y-3 max-w-md mx-auto">
        {missingCostCount > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs p-3 rounded-lg">
            ⚠ มี {missingCostCount} SKU ที่ยังไม่มีต้นทุน (ปิดการขายไว้อัตโนมัติ) — กดแก้ไขเพื่อกรอกต้นทุนแล้วเปิดขายได้เลย
          </div>
        )}

        <button
          onClick={() => setAdding((a) => !a)}
          className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition"
        >
          {adding ? 'ยกเลิกเพิ่มสินค้าใหม่' : '+ เพิ่มสินค้าใหม่'}
        </button>

        {adding && (
          <div className="bg-slate-800 rounded-xl p-4 border border-teal-700/50 space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">สินค้าใหม่</h3>
            <div className="grid grid-cols-2 gap-2">
              <Input label="รหัสสินค้า (code)" type="text" value={newDraft.code}
                onChange={(e) => setNewDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
                placeholder="เช่น OVEN-NEW" />
              <Input label="ชื่อสินค้า" type="text" value={newDraft.name}
                onChange={(e) => setNewDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <Input label="หมวดหมู่ (ถ้ามี)" type="text" value={newDraft.category}
              onChange={(e) => setNewDraft((d) => ({ ...d, category: e.target.value }))} />
            <CostFields draft={newDraft} setDraft={setNewDraft} />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition disabled:opacity-50"
            >
              {creating ? 'กำลังบันทึก...' : 'เพิ่มสินค้านี้'}
            </button>
          </div>
        )}

        <div className="flex gap-2">
          {[
            { key: 'all', label: `ทั้งหมด (${skus.length})` },
            { key: 'active', label: 'ขายอยู่' },
            { key: 'inactive', label: 'ปิดขาย' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`flex-1 text-xs py-1.5 rounded-lg transition ${
                filter === opt.key ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm">กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500 text-sm bg-slate-800/50 rounded-lg p-3">ไม่มีรายการ</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => {
              const isEditing = editingId === s.id
              const landed = s.cost_currency === 'THB'
                ? toNum(s.cost_amount) + toNum(s.shipping_per_unit)
                : toNum(s.cost_amount) * toNum(s.fx_rate, 1) + toNum(s.shipping_per_unit)
              return (
                <div key={s.id} className="bg-slate-800 rounded-lg border border-slate-700 p-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input label="รหัสสินค้า (code)" type="text" value={draft.code}
                          onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))} />
                        <Input label="ชื่อสินค้า" type="text" value={draft.name}
                          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                      </div>
                      <Input label="หมวดหมู่" type="text" value={draft.category}
                        onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} />
                      <CostFields draft={draft} setDraft={setDraft} />
                      <div className="grid grid-cols-2 gap-2">
                        <Input label="ราคาขายปัจจุบัน" type="number" step="1" value={draft.current_price}
                          onChange={(e) => setDraft((d) => ({ ...d, current_price: e.target.value }))} />
                        <Input label="ราคาคู่แข่ง" type="number" step="1" value={draft.competitor_price}
                          onChange={(e) => setDraft((d) => ({ ...d, competitor_price: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input label="กำไรขั้นต่ำ (%)" type="number" step="1" value={draft.min_margin}
                          onChange={(e) => setDraft((d) => ({ ...d, min_margin: e.target.value }))} />
                        <Input label="จุดสั่งซื้อ (ชิ้น)" type="number" step="1" value={draft.reorder_point}
                          onChange={(e) => setDraft((d) => ({ ...d, reorder_point: e.target.value }))} />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-slate-300 py-1">
                        <input type="checkbox" checked={draft.active}
                          onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
                          className="w-4 h-4 accent-teal-500" />
                        เปิดขาย (แสดงในหน้าคีย์ข้อมูล/สต๊อก)
                      </label>
                      <div className="flex items-center gap-2 pt-1">
                        <button onClick={() => saveEdit(s.id)} disabled={savingId === s.id}
                          className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition disabled:opacity-50">
                          {savingId === s.id ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                        <button onClick={cancelEdit} className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition">
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{s.code} — {s.name}</span>
                          {!s.active && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-600/40 text-slate-400">ปิดขาย</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          ต้นทุน {landed.toLocaleString('th-TH', { maximumFractionDigits: 2 })} บาท/ชิ้น
                          {s.current_price ? ` · ราคาขาย ${Number(s.current_price).toLocaleString('th-TH')} บาท` : ' · ยังไม่ตั้งราคาขาย'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => startEdit(s)}
                          className="text-xs px-2 py-1 rounded text-teal-400/80 hover:text-teal-400 hover:bg-teal-500/10 transition">
                          แก้ไข
                        </button>
                        <ConfirmDeleteButton onConfirm={() => handleDelete(s.id)} busy={deletingId === s.id}
                          warning="⚠ ถ้ามีประวัติการขายผูกอยู่จะลบไม่ได้ — ใช้ปิดขายแทน" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
