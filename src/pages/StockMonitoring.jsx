import { useEffect, useState } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Legend,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { exportToCsv, todayStamp } from '../lib/csvExport'
import { Select } from '../components/FormFields'

// เขียวเหลือเยอะ / เหลืองใกล้ต้องสั่ง / แดงต้องสั่งแล้วหรือหมด
function stockColor(row) {
  if (row.on_hand <= 0) return '#ef4444' // แดงเข้ม หมดสต๊อก
  if (row.action === 'สั่งเพิ่ม') return '#f59e0b' // เหลือง
  if (row.action === 'ไม่เคลื่อนไหว') return '#64748b' // เทา ไม่นับเป็นความเสี่ยง
  return '#14b8a6' // เขียว/teal ปกติ
}

const STORE_COLORS = ['#14b8a6', '#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#4ade80', '#facc15']

function ChartCard({ title, subtitle, children, height = 260 }) {
  return (
    <section className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 mb-2">{subtitle}</p>}
      <div style={{ width: '100%', height }} className="mt-2">
        {children}
      </div>
    </section>
  )
}

function tooltipStyle() {
  return {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 8,
    fontSize: 12,
    color: '#e2e8f0',
  }
}

export default function StockMonitoring({ onBack }) {
  const [stock, setStock] = useState([])
  const [storeSales, setStoreSales] = useState([])
  const [salesRange, setSalesRange] = useState('30') // '7' | '30' | 'all'
  const [provinceSku, setProvinceSku] = useState('') // '' = ทุก SKU
  const [provinceMonth, setProvinceMonth] = useState(new Date().toISOString().slice(0, 7)) // 'YYYY-MM' หรือ 'all'
  const [provinceData, setProvinceData] = useState([])
  const [provinceLoading, setProvinceLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [salesLoading, setSalesLoading] = useState(false)
  const [error, setError] = useState('')
  const [exportBusy, setExportBusy] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase.from('stock_status').select('*').order('code')
      if (error) setError(error.message)
      setStock(data || [])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    async function loadStoreSales() {
      setSalesLoading(true)

      const storesRes = await supabase.from('stores').select('id, name, kind').eq('active', true)

      let query = supabase.from('movements').select('store_id, qty, moved_on').eq('kind', 'out')
      if (salesRange !== 'all') {
        const days = Number(salesRange)
        const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        query = query.gte('moved_on', fromDate)
      }
      const movementsRes = await query

      const storeMap = new Map((storesRes.data || []).map((s) => [s.id, s.name]))
      const unitsByStore = {}
      for (const m of movementsRes.data || []) {
        if (!m.store_id) continue
        const name = storeMap.get(m.store_id) || 'ไม่ระบุ'
        unitsByStore[name] = (unitsByStore[name] || 0) + Math.abs(m.qty)
      }
      const storeArr = Object.entries(unitsByStore)
        .map(([name, units]) => ({ name, units }))
        .sort((a, b) => b.units - a.units)
      setStoreSales(storeArr)
      setSalesLoading(false)
    }
    loadStoreSales()
  }, [salesRange])

  // ยอดขายตามจังหวัดลูกค้า — รวมทั้งข้อมูลปัจจุบัน (movements) และย้อนหลังที่นำเข้า (historical_sales)
  useEffect(() => {
    async function loadProvinceSales() {
      setProvinceLoading(true)

      let query = supabase
        .from('province_sales_unified')
        .select('qty, customer_province')

      if (provinceSku) query = query.eq('sku_id', provinceSku)
      if (provinceMonth !== 'all') {
        const [y, m] = provinceMonth.split('-').map(Number)
        const start = `${provinceMonth}-01`
        const end = new Date(y, m, 0).toISOString().slice(0, 10)
        query = query.gte('sold_on', start).lte('sold_on', end)
      }

      const { data, error } = await query
      if (error) {
        setProvinceData([])
        setProvinceLoading(false)
        return
      }

      const unitsByProvince = {}
      for (const m of data || []) {
        unitsByProvince[m.customer_province] = (unitsByProvince[m.customer_province] || 0) + Math.abs(m.qty)
      }
      const arr = Object.entries(unitsByProvince)
        .map(([province, units]) => ({ province, units }))
        .sort((a, b) => b.units - a.units)
      setProvinceData(arr)
      setProvinceLoading(false)
    }
    loadProvinceSales()
  }, [provinceSku, provinceMonth])

  async function exportStockStatus() {
    setExportBusy('stock')
    const { data, error } = await supabase.from('stock_status').select('*').order('code')
    if (error) {
      alert('ดึงข้อมูลไม่สำเร็จ: ' + error.message)
    } else {
      exportToCsv(`สต็อกคงเหลือ_${todayStamp()}.csv`, (data || []).map((r) => ({
        รหัสสินค้า: r.code,
        ชื่อสินค้า: r.name,
        คงเหลือ: r.on_hand,
        ขายเฉลี่ยต่อวัน: r.per_day,
        คุ้มครองกี่วัน: r.days_cover,
        เงินจมในสต๊อกนี้: r.capital_value,
        จุดสั่งซื้อ: r.reorder_point,
        สถานะ: r.action,
      })))
    }
    setExportBusy('')
  }

  async function exportMovements() {
    setExportBusy('movements')
    const { data, error } = await supabase
      .from('movements')
      .select('moved_on, kind, qty, order_no, note, unit_cost, created_by, skus(code, name), stores(name)')
      .order('moved_on', { ascending: false })

    if (error) {
      alert('ดึงข้อมูลไม่สำเร็จ: ' + error.message)
    } else {
      const kindLabel = { in: 'รับเข้า', out: 'ขายออก', return: 'ตีกลับ', adjust: 'ปรับปรุงยอด' }
      exportToCsv(`รายการเคลื่อนไหวสต๊อก_${todayStamp()}.csv`, (data || []).map((r) => ({
        วันที่: r.moved_on,
        ประเภท: kindLabel[r.kind] || r.kind,
        รหัสสินค้า: r.skus?.code || '',
        ชื่อสินค้า: r.skus?.name || '',
        ร้าน: r.stores?.name || 'คลังกลาง',
        จำนวน: r.qty,
        ต้นทุนต่อชิ้น: r.unit_cost,
        เลขที่ออเดอร์: r.order_no || '',
        หมายเหตุ: r.note || '',
      })))
    }
    setExportBusy('')
  }

  async function exportProvinceSales() {
    setExportBusy('province')
    const [salesRes, skuRes] = await Promise.all([
      supabase
        .from('province_sales_unified')
        .select('sold_on, qty, customer_province, sku_id')
        .order('sold_on', { ascending: false }),
      supabase.from('skus').select('id, code, name'),
    ])

    if (salesRes.error) {
      alert('ดึงข้อมูลไม่สำเร็จ: ' + salesRes.error.message)
    } else {
      const skuMap = new Map((skuRes.data || []).map((s) => [s.id, s]))
      const map = new Map()
      for (const r of salesRes.data || []) {
        const month = r.sold_on.slice(0, 7)
        const sku = skuMap.get(r.sku_id)
        const key = `${sku?.code}|${r.customer_province}|${month}`
        if (!map.has(key)) {
          map.set(key, {
            เดือน: month,
            รหัสสินค้า: sku?.code || '',
            ชื่อสินค้า: sku?.name || '',
            จังหวัด: r.customer_province,
            ปริมาณ_ชิ้น: 0,
          })
        }
        map.get(key).ปริมาณ_ชิ้น += Math.abs(r.qty)
      }
      const rows = [...map.values()].sort((a, b) => {
        if (a.เดือน !== b.เดือน) return b.เดือน.localeCompare(a.เดือน)
        if (a.รหัสสินค้า !== b.รหัสสินค้า) return a.รหัสสินค้า.localeCompare(b.รหัสสินค้า)
        return b.ปริมาณ_ชิ้น - a.ปริมาณ_ชิ้น
      })
      exportToCsv(`ยอดขายตามจังหวัด_${todayStamp()}.csv`, rows)
    }
    setExportBusy('')
  }

  const pieData = stock.map((s) => ({ name: s.code, value: s.on_hand }))

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-4 flex items-center gap-3 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <button onClick={onBack} className="text-slate-400 hover:text-teal-400 transition text-sm">
          ← กลับ
        </button>
        <h1 className="text-lg font-bold">Stock Monitoring</h1>
      </header>

      <main className="p-4 space-y-6 max-w-3xl mx-auto">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg">
            โหลดข้อมูลไม่สำเร็จ: {error}
          </div>
        )}

        <section className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h2 className="text-sm font-semibold text-slate-200 mb-1">Export ข้อมูล (CSV)</h2>
          <p className="text-xs text-slate-500 mb-3">เปิดได้ทั้งใน Excel และ Google Sheets</p>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={exportStockStatus}
              disabled={exportBusy !== ''}
              className="text-sm py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition disabled:opacity-50 text-left px-3"
            >
              {exportBusy === 'stock' ? 'กำลังเตรียมไฟล์...' : '📦 สต็อกคงเหลือปัจจุบัน'}
            </button>
            <button
              onClick={exportMovements}
              disabled={exportBusy !== ''}
              className="text-sm py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition disabled:opacity-50 text-left px-3"
            >
              {exportBusy === 'movements' ? 'กำลังเตรียมไฟล์...' : '📋 รายการเคลื่อนไหวสต๊อกทั้งหมด'}
            </button>
            <button
              onClick={exportProvinceSales}
              disabled={exportBusy !== ''}
              className="text-sm py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition disabled:opacity-50 text-left px-3"
            >
              {exportBusy === 'province' ? 'กำลังเตรียมไฟล์...' : '🗺️ ยอดขายตามจังหวัด (SKU × เดือน)'}
            </button>
          </div>
        </section>

        {stock.length > 0 && (() => {
          const totalCapital = stock.reduce((s, r) => s + Number(r.capital_value || 0), 0)
          const deadStock = stock.filter((r) => r.days_cover == null || r.days_cover > 90)
          const deadCapital = deadStock.reduce((s, r) => s + Number(r.capital_value || 0), 0)
          return (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <p className="text-xs text-slate-400">เงินจมในสต๊อกทั้งหมด</p>
                <p className="text-xl font-bold mt-1">฿{totalCapital.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                <p className="text-xs text-red-400">เงินจมใน dead stock ({'>'}90 วัน)</p>
                <p className="text-xl font-bold text-red-400 mt-1">฿{deadCapital.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          )
        })()}

        {loading ? (
          <p className="text-slate-500 text-sm">กำลังโหลด...</p>
        ) : (
          <>
            {/* 1. สต๊อกคงเหลือรายชิ้น ไล่สีตามความเสี่ยง */}
            <ChartCard
              title="สต๊อกคงเหลือรายสินค้า"
              subtitle="เขียว = ปกติ · เหลือง = ต้องสั่งเพิ่ม · แดง = ใกล้หมด/หมดแล้ว · เทา = ไม่เคลื่อนไหว"
              height={Math.max(220, stock.length * 46)}
            >
              <ResponsiveContainer>
                <BarChart data={stock} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis type="category" dataKey="code" stroke="#94a3b8" fontSize={11} width={90} />
                  <Tooltip
                    contentStyle={tooltipStyle()}
                    formatter={(value, _name, props) => [`${value} ชิ้น`, props.payload.name]}
                  />
                  <Bar dataKey="on_hand" radius={[0, 4, 4, 0]}>
                    {stock.map((row) => (
                      <Cell key={row.id} fill={stockColor(row)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* 1.5 อัตราการหมุนสต๊อก — เทียบว่า SKU ไหนออกเร็ว/ช้า พร้อมเงินที่จมอยู่ */}
            <ChartCard
              title="อัตราการหมุนสต๊อก (วันที่สต๊อกอยู่ได้)"
              subtitle="ยิ่งแท่งยาว = ยิ่งออกช้า = เงินจมนาน · เรียงจากช้าสุดไปเร็วสุด"
              height={Math.max(220, stock.length * 46)}
            >
              <ResponsiveContainer>
                <BarChart
                  data={[...stock].sort((a, b) => (b.days_cover ?? 999999) - (a.days_cover ?? 999999))}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis type="category" dataKey="code" stroke="#94a3b8" fontSize={11} width={90} />
                  <Tooltip
                    contentStyle={tooltipStyle()}
                    formatter={(value, _name, props) => [
                      value == null ? 'ไม่เคลื่อนไหวเลย' : `${value} วัน`,
                      `${props.payload.name} · เงินจม ${Number(props.payload.capital_value).toLocaleString('th-TH')} บาท`,
                    ]}
                  />
                  <Bar dataKey="days_cover" radius={[0, 4, 4, 0]}>
                    {stock.map((row) => (
                      <Cell key={row.id} fill={
                        row.days_cover == null || row.days_cover > 90 ? '#ef4444'
                        : row.days_cover > 30 ? '#f59e0b'
                        : '#14b8a6'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* 2. สัดส่วนสต็อกตาม SKU */}
            <ChartCard title="สัดส่วนสต็อกตาม SKU" subtitle="เทียบเป็น % ของจำนวนชิ้นคงเหลือทั้งหมด">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={STORE_COLORS[i % STORE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle()} formatter={(value) => [`${value} ชิ้น`]} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* 3. เปรียบเทียบยอดขายรายร้าน */}
            <section className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-slate-200">ยอดขายรายร้าน (จำนวนชิ้น)</h2>
                <div className="flex gap-1">
                  {[
                    { key: '7', label: '7 วัน' },
                    { key: '30', label: '30 วัน' },
                    { key: 'all', label: 'ทั้งหมด' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setSalesRange(opt.key)}
                      className={`text-[11px] px-2 py-1 rounded-md transition ${
                        salesRange === opt.key
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                เทียบว่าร้านไหน performance ดีในช่วงที่เลือก — ใช้ดูแนวโน้มการออกของสินค้าต่อร้าน
              </p>
              <div style={{ width: '100%', height: Math.max(200, storeSales.length * 40) }}>
                {salesLoading ? (
                  <p className="text-slate-500 text-sm">กำลังโหลด...</p>
                ) : storeSales.length === 0 ? (
                  <p className="text-slate-500 text-sm">ไม่มีข้อมูลยอดขายผูกกับร้านในช่วงนี้</p>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={storeSales} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" stroke="#64748b" fontSize={11} />
                      <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={90} />
                      <Tooltip contentStyle={tooltipStyle()} formatter={(value) => [`${value} ชิ้น`, 'ขายแล้ว']} />
                      <Bar dataKey="units" fill="#38bdf8" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            {/* 4. ยอดขายตามจังหวัดลูกค้า — กรองตาม SKU และเดือน */}
            <section className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <h2 className="text-sm font-semibold text-slate-200 mb-1">ยอดขายตามจังหวัดลูกค้า</h2>
              <p className="text-xs text-slate-500 mb-3">
                ดูว่า SKU ไหนขายดีจังหวัดไหน ช่วงเดือนไหน — นับเฉพาะรายการที่คีย์จังหวัดลูกค้าไว้ตอนขายออก
              </p>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <Select
                  label="สินค้า"
                  value={provinceSku}
                  onChange={setProvinceSku}
                  placeholder="ทุก SKU"
                  options={stock.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
                />
                <div>
                  <label className="text-xs text-slate-400">เดือน</label>
                  <div className="flex gap-1.5 mt-1">
                    <input
                      type="month"
                      value={provinceMonth === 'all' ? new Date().toISOString().slice(0, 7) : provinceMonth}
                      onChange={(e) => setProvinceMonth(e.target.value)}
                      disabled={provinceMonth === 'all'}
                      className="flex-1 min-w-0 px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-teal-500 disabled:opacity-40"
                    />
                    <button
                      type="button"
                      onClick={() => setProvinceMonth((m) => (m === 'all' ? new Date().toISOString().slice(0, 7) : 'all'))}
                      className={`text-xs px-2.5 rounded-lg font-medium transition flex-shrink-0 ${
                        provinceMonth === 'all' ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      ทั้งหมด
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ width: '100%', height: Math.max(160, provinceData.length * 36) }}>
                {provinceLoading ? (
                  <p className="text-slate-500 text-sm">กำลังโหลด...</p>
                ) : provinceData.length === 0 ? (
                  <p className="text-slate-500 text-sm">ไม่มีข้อมูลจังหวัดลูกค้าตามเงื่อนไขที่เลือก</p>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={provinceData} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" stroke="#64748b" fontSize={11} />
                      <YAxis type="category" dataKey="province" stroke="#94a3b8" fontSize={11} width={90} />
                      <Tooltip contentStyle={tooltipStyle()} formatter={(value) => [`${value} ชิ้น`, 'ขายแล้ว']} />
                      <Bar dataKey="units" fill="#a78bfa" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
