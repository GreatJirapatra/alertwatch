import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Select } from '../components/FormFields'

function excelDateToIso(val) {
  // Shopee ให้มาเป็น string วันที่ 'YYYY-MM-DD' หรือ 'YYYY-MM-DD HH:mm' อยู่แล้วเกือบทุกกรณี
  if (!val) return null
  if (typeof val === 'string') {
    const d = val.slice(0, 10)
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
  }
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  // เผื่อเป็น excel serial number
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (!d) return null
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  return null
}

export default function ImportShopee({ onBack }) {
  const { user } = useAuth()
  const [mode, setMode] = useState('income') // orders | income
  const [stores, setStores] = useState([])
  const [storeId, setStoreId] = useState('')
  const [skus, setSkus] = useState([])
  const [aliases, setAliases] = useState({}) // shopee_name -> sku_id
  const [parsedOrders, setParsedOrders] = useState(null) // [{orderNo, date, shopeeName, qty, matchedSkuId}]
  const [parsedIncome, setParsedIncome] = useState(null) // [{orderNo, settledOn, grossPrice, actualAmount}]
  const [existingOrderNos, setExistingOrderNos] = useState(new Set())
  const [fileError, setFileError] = useState('')
  const [committing, setCommitting] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    async function load() {
      const [storeRes, skuRes, aliasRes] = await Promise.all([
        supabase.from('stores').select('id, name, kind').eq('active', true).order('kind').order('name'),
        supabase.from('skus').select('id, code, name').eq('active', true).order('code'),
        supabase.from('sku_import_aliases').select('shopee_name, sku_id').eq('platform', 'shopee'),
      ])
      setStores(storeRes.data || [])
      setSkus(skuRes.data || [])
      const aliasMap = {}
      for (const a of aliasRes.data || []) aliasMap[a.shopee_name] = a.sku_id
      setAliases(aliasMap)
    }
    load()
  }, [])

  function handleOrdersFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError('')
    setParsedOrders(null)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: null })

        const items = []
        for (const row of rows) {
          const status = row['สถานะการสั่งซื้อ']
          if (status !== 'สำเร็จแล้ว') continue // ข้ามออเดอร์ที่ยกเลิก/คืนเงิน

          const orderNo = row['หมายเลขคำสั่งซื้อ']
          const productName = row['ชื่อสินค้า'] || ''
          const optionName = row['ชื่อตัวเลือก'] || ''
          const shopeeName = optionName ? `${productName} | ${optionName}` : productName
          const qty = Number(row['จำนวน']) || 0
          const returned = Number(row['จำนวนที่ส่งคืน']) || 0
          const netQty = qty - returned
          const dateVal = row['เวลาที่ทำการสั่งซื้อสำเร็จ'] || row['วันที่ทำการสั่งซื้อ']

          if (!orderNo || netQty <= 0) continue

          items.push({
            orderNo: String(orderNo),
            date: excelDateToIso(dateVal),
            shopeeName,
            qty: netQty,
            matchedSkuId: aliases[shopeeName] || '',
          })
        }
        setParsedOrders(items)
      } catch (err) {
        setFileError('อ่านไฟล์ไม่สำเร็จ: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function handleIncomeFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError('')
    setParsedIncome(null)
    setResult(null)

    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' })
        const sheet = wb.Sheets['Income']
        if (!sheet) {
          setFileError('ไม่พบชีต "Income" ในไฟล์นี้ — ตรวจสอบว่าเป็นไฟล์ที่ดาวน์โหลดจาก รายรับของฉัน > โอนเงินแล้ว')
          return
        }
        // header จริงอยู่แถวที่ 6 (index 5) ตามโครงสร้างไฟล์จริงที่เจอ
        const rows = XLSX.utils.sheet_to_json(sheet, { range: 5, defval: null })

        const items = []
        for (const row of rows) {
          const orderNo = row['หมายเลขคำสั่งซื้อ']
          const actualAmount = row['จำนวนเงินทั้งหมดที่โอนแล้ว (฿)']
          if (!orderNo || actualAmount == null) continue

          items.push({
            orderNo: String(orderNo),
            settledOn: excelDateToIso(row['วันที่โอนชำระเงินสำเร็จ']),
            grossPrice: Number(row['สินค้าราคาปกติ']) || null,
            actualAmount: Number(actualAmount),
          })
        }
        setParsedIncome(items)

        // เช็คกับฐานข้อมูลว่า order_no ไหนเคยลงไปแล้ว เพื่อบอกผู้ใช้ก่อนบันทึก
        const orderNos = items.map((i) => i.orderNo)
        if (orderNos.length > 0) {
          const { data: existing } = await supabase
            .from('payouts')
            .select('order_no')
            .in('order_no', orderNos)
          setExistingOrderNos(new Set((existing || []).map((e) => e.order_no)))
        }
      } catch (err) {
        setFileError('อ่านไฟล์ไม่สำเร็จ: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function updateMatch(idx, skuId) {
    setParsedOrders((prev) => prev.map((it, i) => (i === idx ? { ...it, matchedSkuId: skuId } : it)))
  }

  async function commitOrders() {
    if (!storeId) {
      setFileError('กรุณาเลือกร้านก่อน')
      return
    }
    const unmatched = parsedOrders.filter((it) => !it.matchedSkuId)
    if (unmatched.length > 0) {
      setFileError(`ยังมี ${unmatched.length} รายการที่ยังไม่ได้จับคู่ SKU กรุณาเลือกให้ครบก่อนบันทึก`)
      return
    }

    setCommitting(true)
    setFileError('')

    // บันทึก alias ใหม่ที่ยังไม่เคยมี (สำหรับ import ครั้งต่อไป)
    const newAliases = parsedOrders
      .filter((it) => !aliases[it.shopeeName])
      .map((it) => ({ platform: 'shopee', shopee_name: it.shopeeName, sku_id: it.matchedSkuId }))
    if (newAliases.length > 0) {
      await supabase.from('sku_import_aliases').upsert(newAliases, { onConflict: 'platform,shopee_name' })
    }

    const movementRows = parsedOrders.map((it) => ({
      sku_id: it.matchedSkuId,
      store_id: storeId,
      kind: 'out',
      qty: -Math.abs(it.qty),
      moved_on: it.date || new Date().toISOString().slice(0, 10),
      order_no: it.orderNo,
      note: 'นำเข้าจาก Shopee Order.completed',
      created_by: user?.id ?? null,
    }))

    const { error } = await supabase.from('movements').insert(movementRows)
    if (error) {
      setFileError('บันทึกไม่สำเร็จ: ' + error.message)
    } else {
      setResult({ type: 'orders', count: movementRows.length })
      setParsedOrders(null)
    }
    setCommitting(false)
  }

  async function commitIncome() {
    setCommitting(true)
    setFileError('')

    const payoutRows = parsedIncome.map((it) => ({
      store_id: storeId || null,
      settled_on: it.settledOn || new Date().toISOString().slice(0, 10),
      order_no: it.orderNo,
      gross_price: it.grossPrice,
      actual_amount: it.actualAmount,
      note: 'นำเข้าจาก Shopee Income',
    }))

    if (!storeId) {
      setFileError('กรุณาเลือกร้านก่อน (Income ไม่มีชื่อร้านในไฟล์ ต้องระบุเอง)')
      setCommitting(false)
      return
    }

    const newCount = parsedIncome.filter((it) => !existingOrderNos.has(it.orderNo)).length
    const updateCount = parsedIncome.length - newCount

    // upsert ตาม order_no — ถ้าเคยลงแล้วจะอัปเดตทับด้วยค่าล่าสุด ไม่สร้างแถวซ้ำ
    const { error } = await supabase
      .from('payouts')
      .upsert(payoutRows, { onConflict: 'order_no' })

    if (error) {
      setFileError('บันทึกไม่สำเร็จ: ' + error.message)
    } else {
      setResult({ type: 'income', count: parsedIncome.length, newCount, updateCount })
      setParsedIncome(null)
      setExistingOrderNos(new Set())
    }
    setCommitting(false)
  }

  const matchedCount = parsedOrders?.filter((it) => it.matchedSkuId).length ?? 0

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-4 flex items-center gap-3 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <button onClick={onBack} className="text-slate-400 hover:text-teal-400 transition text-sm">
          ← กลับ
        </button>
        <h1 className="text-lg font-bold">นำเข้ายอดเงิน Shopee</h1>
      </header>

      <main className="p-4 space-y-4 max-w-md mx-auto">
        <div className="flex gap-2">
          <button
            onClick={() => { setMode('orders'); setFileError(''); setResult(null) }}
            className={`flex-1 text-xs py-2 rounded-lg font-medium transition ${mode === 'orders' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
          >
            Order.completed (ขายออก)
          </button>
          <button
            onClick={() => { setMode('income'); setFileError(''); setResult(null) }}
            className={`flex-1 text-xs py-2 rounded-lg font-medium transition ${mode === 'income' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
          >
            Income (ยอดเงินเข้า)
          </button>
        </div>

        <Select
          label="ร้าน (ไฟล์ Shopee ไม่บอกชื่อร้าน ต้องเลือกเอง)"
          value={storeId}
          onChange={setStoreId}
          placeholder="เลือกร้าน"
          options={stores.map((s) => ({ value: s.id, label: `${s.name} (${s.kind === 'own' ? 'ตัวเอง' : 'เพื่อน'})` }))}
        />

        {mode === 'orders' && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">อัปโหลดไฟล์ Order.completed</h3>
            <p className="text-xs text-slate-500">
              จาก Seller Center: คำสั่งซื้อของฉัน &gt; สำเร็จ &gt; ดาวน์โหลด
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleOrdersFile}
              className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-teal-600 file:text-white file:text-xs"
            />
          </div>
        )}

        {mode === 'income' && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">อัปโหลดไฟล์ Income</h3>
            <p className="text-xs text-slate-500">
              จาก Seller Center: รายรับของฉัน &gt; โอนเงินแล้ว &gt; ดาวน์โหลด
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleIncomeFile}
              className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-teal-600 file:text-white file:text-xs"
            />
          </div>
        )}

        {fileError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg">
            {fileError}
          </div>
        )}

        {result && (
          <div className="bg-teal-500/10 border border-teal-500/30 text-teal-400 text-sm p-3 rounded-lg">
            {result.type === 'orders' ? (
              <>บันทึกรายการขายออกสำเร็จ {result.count} รายการ</>
            ) : (
              <>
                บันทึกยอดเงินเข้าสำเร็จ {result.count} รายการ
                {result.updateCount > 0 && (
                  <span className="block text-xs mt-1">
                    (ใหม่ {result.newCount} · อัปเดตทับของเดิม {result.updateCount})
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {/* Preview: Orders */}
        {mode === 'orders' && parsedOrders && (
          <div className="space-y-3">
            <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 flex items-center justify-between">
              <p className="text-sm">พบ {parsedOrders.length} รายการ</p>
              <p className={`text-sm font-medium ${matchedCount === parsedOrders.length ? 'text-teal-400' : 'text-yellow-400'}`}>
                จับคู่แล้ว {matchedCount}/{parsedOrders.length}
              </p>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {parsedOrders.map((it, idx) => (
                <div key={idx} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">{it.orderNo} · {it.date} · จำนวน {it.qty}</p>
                  <p className="text-xs text-slate-300 mb-2 line-clamp-2">{it.shopeeName}</p>
                  <Select
                    label=""
                    value={it.matchedSkuId}
                    onChange={(v) => updateMatch(idx, v)}
                    placeholder="เลือก SKU ที่ตรงกัน"
                    options={skus.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={commitOrders}
              disabled={committing || matchedCount !== parsedOrders.length}
              className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition disabled:opacity-50"
            >
              {committing ? 'กำลังบันทึก...' : `บันทึก ${parsedOrders.length} รายการเป็นสต๊อกขายออก`}
            </button>
          </div>
        )}

        {/* Preview: Income */}
        {mode === 'income' && parsedIncome && (
          <div className="space-y-3">
            <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 space-y-1">
              <p className="text-sm">พบ {parsedIncome.length} รายการ รวม {parsedIncome.reduce((s, r) => s + r.actualAmount, 0).toLocaleString('th-TH')} บาท</p>
              {existingOrderNos.size > 0 ? (
                <p className="text-xs text-yellow-400">
                  ในนี้มี {existingOrderNos.size} รายการที่เคยลงไปแล้ว — จะถูกอัปเดตทับด้วยค่าล่าสุด ไม่สร้างแถวซ้ำ
                </p>
              ) : (
                <p className="text-xs text-teal-400">ทั้งหมดเป็นรายการใหม่ ยังไม่เคยลงในระบบ</p>
              )}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {parsedIncome.slice(0, 20).map((it, idx) => {
                const isDup = existingOrderNos.has(it.orderNo)
                return (
                  <div key={idx} className={`rounded-lg p-3 border flex items-center justify-between ${isDup ? 'bg-yellow-500/5 border-yellow-500/30' : 'bg-slate-800 border-slate-700'}`}>
                    <div>
                      <p className="text-xs text-slate-400">{it.orderNo} · {it.settledOn}</p>
                      {isDup && <p className="text-xs text-yellow-400 mt-0.5">เคยลงแล้ว — จะอัปเดตทับ</p>}
                    </div>
                    <p className="text-sm text-teal-400 font-medium">{it.actualAmount.toLocaleString('th-TH')} บ.</p>
                  </div>
                )
              })}
              {parsedIncome.length > 20 && (
                <p className="text-xs text-slate-500 text-center">และอีก {parsedIncome.length - 20} รายการ</p>
              )}
            </div>

            <button
              onClick={commitIncome}
              disabled={committing}
              className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition disabled:opacity-50"
            >
              {committing ? 'กำลังบันทึก...' : `บันทึก ${parsedIncome.length} รายการ`}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
