import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Select, Input } from '../components/FormFields'
import { SearchableSelect } from '../components/SearchableSelect'

const KIND_OPTIONS = [
  { value: 'in', label: 'รับเข้า (+)' },
  { value: 'out', label: 'ขายออก (-)' },
  { value: 'return', label: 'ตีกลับ (+)' },
  { value: 'adjust', label: 'ปรับปรุงยอด (+/-)' },
  { value: 'lost', label: 'ของหาย/ส่งเกิน (-)' },
]

export default function MovementForm({ onDone, onToast }) {
  const { user } = useAuth()
  const [skus, setSkus] = useState([])
  const [stores, setStores] = useState([])
  const [provinces, setProvinces] = useState([])
  const [skuId, setSkuId] = useState('')
  const [storeId, setStoreId] = useState('')
  const [kind, setKind] = useState('out')
  const [qty, setQty] = useState('')
  const [movedOn, setMovedOn] = useState(new Date().toISOString().slice(0, 10))
  const [orderNo, setOrderNo] = useState('')
  const [customerProvince, setCustomerProvince] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // { type: 'ok'|'err', text }

  useEffect(() => {
    async function load() {
      const [skuRes, storeRes, provinceRes] = await Promise.all([
        supabase.from('skus').select('id, code, name, cost_amount, cost_currency, fx_rate, shipping_per_unit').eq('active', true).order('code'),
        supabase.from('stores').select('id, name, kind').eq('active', true).order('kind').order('name'),
        supabase.from('provinces').select('name').order('name'),
      ])
      setSkus(skuRes.data || [])
      setStores(storeRes.data || [])
      setProvinces(provinceRes.data || [])
    }
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setMsg(null)

    if (!skuId || !qty) {
      setMsg({ type: 'err', text: 'กรุณาเลือกสินค้าและใส่จำนวน' })
      return
    }

    let signedQty = Math.abs(Number(qty))
    if (kind === 'out' || kind === 'lost') signedQty = -signedQty
    // adjust ให้ใส่ค่าติดลบเองได้ถ้าต้องการ (ผู้ใช้พิมพ์ -5 ได้ตรงๆ)
    if (kind === 'adjust') signedQty = Number(qty)

    if (signedQty === 0) {
      setMsg({ type: 'err', text: 'จำนวนต้องไม่เป็น 0' })
      return
    }

    setBusy(true)
    const { error } = await supabase.from('movements').insert({
      sku_id: skuId,
      store_id: storeId || null,
      kind,
      qty: signedQty,
      moved_on: movedOn,
      order_no: orderNo || null,
      customer_province: customerProvince || null,
      note: note || null,
      created_by: user?.id ?? null,
    })

    if (error) {
      setMsg({ type: 'err', text: error.message })
      onToast?.({ type: 'error', text: 'บันทึกไม่สำเร็จ: ' + error.message })
    } else {
      setMsg(null)
      setQty('')
      setOrderNo('')
      setCustomerProvince('')
      setNote('')
      onDone?.()
      onToast?.({ type: 'ok', text: 'บันทึกรายการสต๊อกแล้ว' })
    }
    setBusy(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h3 className="text-sm font-semibold text-slate-200">คีย์การเคลื่อนไหวสต๊อก</h3>

      <Select
        label="สินค้า"
        value={skuId}
        onChange={setSkuId}
        placeholder="เลือกสินค้า"
        options={skus.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
      />

      <Select
        label="ประเภทรายการ"
        value={kind}
        onChange={setKind}
        options={KIND_OPTIONS}
      />

      {kind === 'in' && (() => {
        // ต้นทุนจะถูกล็อคติดรายการนี้ตอนกดบันทึก แก้ทีหลังไม่ย้อนกลับมาแก้รายการนี้
        // เลยต้องเตือนให้เช็คต้นทุนให้ตรงกับ lot ที่กำลังรับเข้าก่อน
        const sku = skus.find((s) => s.id === skuId)
        const landed = sku
          ? (sku.cost_currency === 'THB'
              ? Number(sku.cost_amount || 0)
              : Number(sku.cost_amount || 0) * Number(sku.fx_rate || 1)
            ) + Number(sku.shipping_per_unit || 0)
          : null
        return (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 space-y-1.5">
            <p className="text-xs text-yellow-400 font-medium">
              ⚠️ เช็คต้นทุนให้ตรงกับ lot นี้ก่อนบันทึก
            </p>
            <p className="text-[11px] text-yellow-400/80 leading-relaxed">
              ระบบจะล็อคต้นทุนติดกับรายการนี้ทันทีที่กดบันทึก แก้ต้นทุนทีหลังจะไม่ย้อนมาแก้รายการนี้
              ถ้าต้นทุน lot นี้เปลี่ยนไป ต้องไปแก้ที่หน้า &ldquo;จัดการสินค้า / ต้นทุน&rdquo; ก่อน แล้วค่อยกลับมาคีย์
            </p>
            {sku && landed != null && (
              <p className="text-xs text-yellow-300 pt-1">
                ต้นทุนปัจจุบันของ {sku.code}: <span className="font-bold">฿{landed.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</span> /ชิ้น
              </p>
            )}
            {!sku && (
              <p className="text-[11px] text-yellow-400/60 pt-1">เลือกสินค้าด้านบนเพื่อดูต้นทุนปัจจุบัน</p>
            )}
          </div>
        )
      })()}

      <Select
        label="ร้าน (เว้นว่าง = คลังกลาง)"
        value={storeId}
        onChange={setStoreId}
        placeholder="คลังกลาง"
        options={stores.map((s) => ({ value: s.id, label: `${s.name} (${s.kind === 'own' ? 'ตัวเอง' : 'เพื่อน'})` }))}
      />

      <Input
        label={kind === 'adjust' ? 'จำนวน (ใส่ - หน้าเลขได้ถ้าต้องการลด)' : 'จำนวน'}
        type="number"
        step="1"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        placeholder="เช่น 5"
      />

      <Input
        label="วันที่"
        type="date"
        value={movedOn}
        onChange={(e) => setMovedOn(e.target.value)}
      />

      <Input
        label="เลขที่ออเดอร์ (ถ้ามี)"
        type="text"
        value={orderNo}
        onChange={(e) => setOrderNo(e.target.value)}
        placeholder="เช่น MM-1023"
      />

      <SearchableSelect
        label="จังหวัดลูกค้า (ถ้ามี — สำหรับข้อมูล marketing)"
        value={customerProvince}
        onChange={setCustomerProvince}
        placeholder="ไม่ระบุ"
        options={provinces.map((p) => ({ value: p.name, label: p.name }))}
      />

      <Input
        label="หมายเหตุ (ถ้ามี)"
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="เช่น ลูกค้าตีกลับของไม่ตรงสเปค"
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
