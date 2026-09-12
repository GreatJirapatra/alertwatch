import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from '../lib/supabase'
import { exportToCsv, todayStamp } from '../lib/csvExport'
import { Select } from '../components/FormFields'

function tooltipStyle() {
  return {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 8,
    fontSize: 12,
    color: '#ffffff',
  }
}

const tooltipLabelStyle = { color: '#ffffff', fontWeight: 600 }
const tooltipItemStyle = { color: '#ffffff' }

const STORE_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#4ade80', '#facc15', '#f87171', '#94a3b8']

function monthLabelOf(monthStr) {
  return new Date(monthStr).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' })
}

function aggregateMonthly(rows, valueKey) {
  const map = new Map()
  for (const r of rows) {
    const month = r.date.slice(0, 7) + '-01'
    map.set(month, (map.get(month) || 0) + Number(r[valueKey] || 0))
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, value]) => ({ month, monthLabel: monthLabelOf(month), value }))
}

function aggregateAnnual(rows, valueKey) {
  const map = new Map()
  for (const r of rows) {
    const year = r.date.slice(0, 4)
    map.set(year, (map.get(year) || 0) + Number(r[valueKey] || 0))
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, value]) => ({ year, value }))
}

// รวมทุกแถวก่อนวันตัดรอบเป็นแท่งเดียว "ก่อน 31 กค 69" แล้วค่อยแยกรายเดือนตามปกติตั้งแต่วันตัดรอบเป็นต้นไป
// ใช้กับกราฟต้นทุนสต๊อก เพราะช่วงก่อนตัดรอบคีย์ยอดรวมไว้ก้อนเดียว ไม่ได้ลงรายเดือนจริง
function aggregateMonthlyWithCutoff(rows, valueKey, cutoffISO) {
  const before = { month: 'before-cutoff', monthLabel: `ก่อน ${cutoffLabel(cutoffISO)}`, value: 0 }
  const map = new Map()
  for (const r of rows) {
    if (r.date < cutoffISO) {
      before.value += Number(r[valueKey] || 0)
      continue
    }
    const month = r.date.slice(0, 7) + '-01'
    map.set(month, (map.get(month) || 0) + Number(r[valueKey] || 0))
  }
  const afterRows = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, value]) => ({ month, monthLabel: monthLabelOf(month), value }))
  return before.value !== 0 ? [before, ...afterRows] : afterRows
}

function cutoffLabel(cutoffISO) {
  const d = new Date(cutoffISO)
  d.setDate(d.getDate() - 1) // วันสุดท้ายก่อนวันตัดรอบ
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

const COST_CUTOFF = '2026-08-01' // ก่อนวันนี้ = คีย์ยอดรวมก้อนเดียวตามที่ตกลงกัน

function MetricChartPair({ title, subtitle, monthlyData, annualData, color, unit, colorByValue, emptyText }) {
  const isEmpty = monthlyData.length === 0
  return (
    <section className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 mb-2">{subtitle}</p>}
      {isEmpty ? (
        <p className="text-slate-500 text-sm py-4">{emptyText || 'ยังไม่มีข้อมูล'}</p>
      ) : (
        <>
          <p className="text-xs text-slate-400 mt-2 mb-1">รายเดือน</p>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={monthlyData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="monthLabel" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  contentStyle={tooltipStyle()} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle}
                  formatter={(value) => [`${Number(value).toLocaleString('th-TH', { maximumFractionDigits: 0 })} ${unit}`, title]}
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {monthlyData.map((d, i) => (
                    <Cell key={i} fill={colorByValue ? (d.value >= 0 ? color : '#ef4444') : color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p className="text-xs text-slate-400 mt-3 mb-1">รายปี</p>
          <div style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer>
              <BarChart data={annualData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="year" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  contentStyle={tooltipStyle()} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle}
                  formatter={(value) => [`${Number(value).toLocaleString('th-TH', { maximumFractionDigits: 0 })} ${unit}`, title]}
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {annualData.map((d, i) => (
                    <Cell key={i} fill={colorByValue ? (d.value >= 0 ? color : '#ef4444') : color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  )
}

// กราฟแท่งแนวนอนเทียบทุก SKU พร้อมกัน (ยอดรวมทั้งหมด ไม่ผูกกับตัวกรองสินค้าด้านบน)
function BySkuBarChart({ title, subtitle, data, color, unit, colorByValue, emptyText }) {
  if (data.length === 0) {
    return (
      <section className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mb-2">{subtitle}</p>}
        <p className="text-slate-500 text-sm py-4">{emptyText || 'ยังไม่มีข้อมูล'}</p>
      </section>
    )
  }
  return (
    <section className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 mb-2">{subtitle}</p>}
      <div style={{ width: '100%', height: Math.max(180, data.length * 32) }} className="mt-2">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <YAxis type="category" dataKey="code" stroke="#94a3b8" fontSize={11} width={90} />
            <Tooltip
              contentStyle={tooltipStyle()} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle}
              formatter={(value, _name, props) => [`${Number(value).toLocaleString('th-TH', { maximumFractionDigits: 0 })} ${unit}`, props.payload.name]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={colorByValue ? (d.value >= 0 ? color : '#ef4444') : color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

// รวมยอดทั้งหมดต่อ SKU (ไม่แยกเดือน) เรียงมากไปน้อย ใช้เทียบ SKU กันตรงๆ
function totalsBySku(rows, valueKey, skus) {
  const skuMap = new Map(skus.map((s) => [s.id, s]))
  const totals = new Map()
  for (const r of rows) {
    totals.set(r.sku_id, (totals.get(r.sku_id) || 0) + Number(r[valueKey] || 0))
  }
  return [...totals.entries()]
    .map(([sku_id, value]) => ({ sku_id, code: skuMap.get(sku_id)?.code || '?', name: skuMap.get(sku_id)?.name || '', value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
}

export default function FinanceMonitoring({ onBack }) {
  const [skus, setSkus] = useState([])
  const [selectedSku, setSelectedSku] = useState('')
  const [revenueProfitRows, setRevenueProfitRows] = useState([])
  const [costRows, setCostRows] = useState([])
  const [monthly, setMonthly] = useState([])
  const [adsByStore, setAdsByStore] = useState([])
  const [storeKeys, setStoreKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportBusy, setExportBusy] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [skuRes, rpRes, costRes, plRes, adsRes] = await Promise.all([
        supabase.from('skus').select('id, code, name').order('code'),
        supabase.from('sku_revenue_profit_unified').select('date, sku_id, revenue, profit'),
        supabase.from('sku_stock_in_cost').select('date, sku_id, cost'),
        supabase.from('monthly_revenue_profit_unified').select('*').order('month', { ascending: true }).limit(24),
        supabase.from('monthly_ads_by_store').select('*').order('month', { ascending: true }),
      ])
      if (rpRes.error) setError(rpRes.error.message)
      setSkus(skuRes.data || [])
      setRevenueProfitRows(rpRes.data || [])
      setCostRows(costRes.data || [])
      setMonthly((plRes.data || []).map((m) => ({ ...m, monthLabel: monthLabelOf(m.month) })))

      const stores = [...new Set((adsRes.data || []).map((r) => r.store_name))]
      const byMonth = new Map()
      for (const r of adsRes.data || []) {
        if (!byMonth.has(r.month)) {
          byMonth.set(r.month, { month: r.month, monthLabel: monthLabelOf(r.month), total: 0 })
        }
        const row = byMonth.get(r.month)
        row[r.store_name] = Number(r.amount)
        row.total += Number(r.amount)
      }
      setAdsByStore([...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)))
      setStoreKeys(stores)

      setLoading(false)
    }
    load()
  }, [])

  const filteredRP = useMemo(
    () => (selectedSku ? revenueProfitRows.filter((r) => r.sku_id === selectedSku) : revenueProfitRows),
    [revenueProfitRows, selectedSku]
  )
  const filteredCost = useMemo(
    () => (selectedSku ? costRows.filter((r) => r.sku_id === selectedSku) : costRows),
    [costRows, selectedSku]
  )

  const revenueMonthly = useMemo(() => aggregateMonthly(filteredRP, 'revenue'), [filteredRP])
  const revenueAnnual = useMemo(() => aggregateAnnual(filteredRP, 'revenue'), [filteredRP])
  const profitMonthly = useMemo(() => aggregateMonthly(filteredRP, 'profit'), [filteredRP])
  const profitAnnual = useMemo(() => aggregateAnnual(filteredRP, 'profit'), [filteredRP])
  const costMonthly = useMemo(() => aggregateMonthlyWithCutoff(filteredCost, 'cost', COST_CUTOFF), [filteredCost])
  const costAnnual = useMemo(() => aggregateAnnual(filteredCost, 'cost'), [filteredCost])

  // เทียบทุก SKU พร้อมกัน (ยอดรวมทั้งหมด ไม่ผูกตัวกรองด้านบน)
  const profitBySku = useMemo(() => totalsBySku(revenueProfitRows, 'profit', skus), [revenueProfitRows, skus])
  const costBySku = useMemo(() => totalsBySku(costRows, 'cost', skus), [costRows, skus])

  // real-time: ภาพรวมทั้งหมด + เดือนนี้ (ไม่ผูกตัวกรอง limit 24 เดือนของ monthly_revenue_profit_unified)
  const allTimeRevenue = useMemo(() => revenueProfitRows.reduce((s, r) => s + Number(r.revenue || 0), 0), [revenueProfitRows])
  const allTimeProfit = useMemo(() => revenueProfitRows.reduce((s, r) => s + Number(r.profit || 0), 0), [revenueProfitRows])
  const allTimeCost = useMemo(() => costRows.reduce((s, r) => s + Number(r.cost || 0), 0), [costRows])
  const thisMonthPrefix = new Date().toISOString().slice(0, 7)
  const thisMonthRevenue = useMemo(
    () => revenueProfitRows.filter((r) => r.date.startsWith(thisMonthPrefix)).reduce((s, r) => s + Number(r.revenue || 0), 0),
    [revenueProfitRows, thisMonthPrefix]
  )
  const thisMonthProfit = useMemo(
    () => revenueProfitRows.filter((r) => r.date.startsWith(thisMonthPrefix)).reduce((s, r) => s + Number(r.profit || 0), 0),
    [revenueProfitRows, thisMonthPrefix]
  )

  async function exportMonthlyRevenue() {
    setExportBusy('revenue')
    const { data, error } = await supabase
      .from('monthly_revenue_profit_unified')
      .select('*')
      .order('month', { ascending: false })
    if (error) {
      alert('ดึงข้อมูลไม่สำเร็จ: ' + error.message)
    } else {
      exportToCsv(`รายได้กำไรรายเดือน_${todayStamp()}.csv`, (data || []).map((r) => ({
        เดือน: new Date(r.month).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' }),
        จำนวนชิ้นที่ขาย: r.units,
        รายได้: r.revenue,
        กำไร: r.profit,
        มาร์จิ้น: r.revenue > 0 ? ((r.profit / r.revenue) * 100).toFixed(2) + '%' : '',
      })))
    }
    setExportBusy('')
  }

  async function exportMonthlyPlDetailed() {
    setExportBusy('pl')
    const { data, error } = await supabase.from('monthly_pl').select('*').order('month', { ascending: false })
    if (error) {
      alert('ดึงข้อมูลไม่สำเร็จ: ' + error.message)
    } else {
      exportToCsv(`กำไรขาดทุนรายเดือน_รายละเอียด_${todayStamp()}.csv`, (data || []).map((r) => ({
        เดือน: new Date(r.month).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' }),
        จำนวนชิ้นที่ขาย: r.units,
        เงินเข้าจริง: r.received,
        ต้นทุนขาย: r.cogs,
        ค่าโฆษณา: r.ads,
        กำไรสุทธิ: r.net_profit,
        มาร์จิ้นสุทธิ: r.net_margin != null ? (r.net_margin * 100).toFixed(2) + '%' : '',
        ต้นทุนที่ยังไม่รู้ผล_ยังไม่มีpayoutคู่กัน: r.unmatched_cogs || 0,
        เงินเข้าที่ยังไม่ผูกออเดอร์: r.unmatched_received || 0,
      })))
    }
    setExportBusy('')
  }

  async function exportAdsSpend() {
    setExportBusy('ads')
    const { data, error } = await supabase
      .from('ads_spend_weekly')
      .select('week_ending, amount, note, stores(name)')
      .order('week_ending', { ascending: false })
    if (error) {
      alert('ดึงข้อมูลไม่สำเร็จ: ' + error.message)
    } else {
      exportToCsv(`ค่าโฆษณารายสัปดาห์_${todayStamp()}.csv`, (data || []).map((r) => ({
        สัปดาห์ที่สิ้นสุด: r.week_ending,
        ร้าน: r.stores?.name || '',
        ยอดค่าโฆษณา: r.amount,
        หมายเหตุ: r.note || '',
      })))
    }
    setExportBusy('')
  }

  async function exportStockInCost() {
    setExportBusy('cost')
    const { data, error } = await supabase
      .from('sku_stock_in_cost')
      .select('date, qty, cost, skus(code, name)')
      .order('date', { ascending: false })
    if (error) {
      alert('ดึงข้อมูลไม่สำเร็จ: ' + error.message)
    } else {
      exportToCsv(`ต้นทุนสต๊อกที่นำเข้า_${todayStamp()}.csv`, (data || []).map((r) => ({
        วันที่รับเข้า: r.date,
        รหัสสินค้า: r.skus?.code || '',
        ชื่อสินค้า: r.skus?.name || '',
        จำนวนชิ้น: r.qty,
        ต้นทุนรวม: r.cost,
      })))
    }
    setExportBusy('')
  }

  const skuLabel = selectedSku ? skus.find((s) => s.id === selectedSku)?.name : 'ทุกสินค้ารวมกัน'

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-4 flex items-center gap-3 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <button onClick={onBack} className="text-slate-400 hover:text-teal-400 transition text-sm">
          ← กลับ
        </button>
        <h1 className="text-lg font-bold">Finance Monitoring</h1>
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
              onClick={exportMonthlyRevenue}
              disabled={exportBusy !== ''}
              className="text-sm py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition disabled:opacity-50 text-left px-3"
            >
              {exportBusy === 'revenue' ? 'กำลังเตรียมไฟล์...' : '📊 รายได้กำไรรายเดือน (รวมย้อนหลัง)'}
            </button>
            <button
              onClick={exportMonthlyPlDetailed}
              disabled={exportBusy !== ''}
              className="text-sm py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition disabled:opacity-50 text-left px-3"
            >
              {exportBusy === 'pl' ? 'กำลังเตรียมไฟล์...' : '📋 กำไรขาดทุนละเอียด (COGS/Ads แยก — เฉพาะข้อมูลปัจจุบัน)'}
            </button>
            <button
              onClick={exportStockInCost}
              disabled={exportBusy !== ''}
              className="text-sm py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition disabled:opacity-50 text-left px-3"
            >
              {exportBusy === 'cost' ? 'กำลังเตรียมไฟล์...' : '📦 ต้นทุนสต๊อกที่นำเข้าทั้งหมด'}
            </button>
            <button
              onClick={exportAdsSpend}
              disabled={exportBusy !== ''}
              className="text-sm py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition disabled:opacity-50 text-left px-3"
            >
              {exportBusy === 'ads' ? 'กำลังเตรียมไฟล์...' : '📣 ค่าโฆษณารายสัปดาห์ทั้งหมด'}
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <p className="text-xs text-slate-500 mb-1.5">ภาพรวมทั้งหมด (ทุกช่วงเวลา)</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                <p className="text-[11px] text-slate-400">รายได้</p>
                <p className="text-base font-bold mt-0.5 text-teal-400">฿{allTimeRevenue.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                <p className="text-[11px] text-slate-400">ต้นทุนรับเข้า</p>
                <p className="text-base font-bold mt-0.5 text-orange-400">฿{allTimeCost.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                <p className="text-[11px] text-slate-400">กำไร</p>
                <p className={`text-base font-bold mt-0.5 ${allTimeProfit >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                  ฿{allTimeProfit.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1.5">เดือนนี้ ({new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })})</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-teal-500/10 rounded-xl p-3 border border-teal-500/30">
                <p className="text-[11px] text-teal-400">รายได้เดือนนี้</p>
                <p className="text-base font-bold mt-0.5 text-teal-400">฿{thisMonthRevenue.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className={`rounded-xl p-3 border ${thisMonthProfit >= 0 ? 'bg-purple-500/10 border-purple-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <p className={`text-[11px] ${thisMonthProfit >= 0 ? 'text-purple-400' : 'text-red-400'}`}>กำไรเดือนนี้</p>
                <p className={`text-base font-bold mt-0.5 ${thisMonthProfit >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                  ฿{thisMonthProfit.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <p className="text-slate-500 text-sm">กำลังโหลด...</p>
        ) : (
          <>
            <section className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <Select
                label="ดูข้อมูลของ"
                value={selectedSku}
                onChange={setSelectedSku}
                placeholder="ทุกสินค้ารวมกัน"
                options={skus.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
              />
              <p className="text-xs text-slate-500 mt-2">กำลังดู: {skuLabel}</p>
            </section>

            <MetricChartPair
              title="ต้นทุนสต๊อกที่นำเข้า"
              subtitle="ก่อน 31 กค 69 รวมเป็นก้อนเดียว หลังจากนั้นแยกรายเดือนตามที่คีย์จริง"
              monthlyData={costMonthly}
              annualData={costAnnual}
              color="#fb923c"
              unit="บาท"
              emptyText="ยังไม่มีข้อมูลรับเข้าสต๊อก — เริ่มคีย์ 'รับเข้า' ที่หน้าคีย์ข้อมูลได้เลย"
            />

            <MetricChartPair
              title="รายได้"
              subtitle="นับตามวันที่ขายออกจริง รวมข้อมูลปัจจุบันและย้อนหลัง"
              monthlyData={revenueMonthly}
              annualData={revenueAnnual}
              color="#2dd4bf"
              unit="บาท"
            />

            <MetricChartPair
              title="กำไร (ขาดทุน)"
              subtitle="แดง = เดือน/ปีที่ขาดทุน"
              monthlyData={profitMonthly}
              annualData={profitAnnual}
              color="#a78bfa"
              unit="บาท"
              colorByValue
            />

            {/* เทียบทุก SKU พร้อมกัน — ชัดกว่ารายเดือนตอนสต๊อกยังคาบเกี่ยวกันข้ามเดือนอยู่ */}
            <BySkuBarChart
              title="กำไรแยกตามสินค้า (ยอดรวมทั้งหมด)"
              subtitle="เรียงมากไปน้อย เทียบได้ว่าสินค้าไหนทำกำไรจริงเท่าไหร่"
              data={profitBySku}
              color="#a78bfa"
              unit="บาท"
              colorByValue
            />
            <BySkuBarChart
              title="ต้นทุนสต๊อกแยกตามสินค้า (ยอดรวมทั้งหมด)"
              subtitle="อิงจำนวนสต๊อกที่รับเข้าจริงต่อ SKU"
              data={costBySku}
              color="#fb923c"
              unit="บาท"
              emptyText="ยังไม่มีข้อมูลรับเข้าสต๊อก"
            />

            <section className="bg-slate-800 rounded-lg border border-slate-700 divide-y divide-slate-700">
              {[...monthly].reverse().map((m) => (
                <div key={m.month} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm">{new Date(m.month).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })}</p>
                    <p className="text-xs text-slate-500">{m.units} ชิ้น</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-teal-400">฿{Number(m.revenue).toLocaleString('th-TH', { maximumFractionDigits: 0 })}</p>
                    <p className={`text-xs ${m.profit >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                      กำไร ฿{Number(m.profit).toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              ))}
            </section>

            <section className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <h2 className="text-sm font-semibold text-slate-200">ค่าโฆษณารายเดือน แยกตามร้าน</h2>
              <p className="text-xs text-slate-500 mb-2">รวมจากยอดที่คีย์รายสัปดาห์ทุกสุดสัปดาห์</p>
              <div style={{ width: '100%', height: 260 }}>
                {adsByStore.length === 0 ? (
                  <p className="text-slate-500 text-sm">ยังไม่มีข้อมูลค่าโฆษณา — เริ่มคีย์ได้ที่หน้าคีย์ข้อมูล → ค่าโฆษณา</p>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={adsByStore} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="monthLabel" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <Tooltip
                        contentStyle={tooltipStyle()} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle}
                        formatter={(value, name) => [`${Number(value).toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท`, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {storeKeys.map((name, i) => (
                        <Bar key={name} dataKey={name} stackId="ads" fill={STORE_COLORS[i % STORE_COLORS.length]} radius={i === storeKeys.length - 1 ? [3, 3, 0, 0] : undefined} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <h2 className="text-sm font-semibold text-slate-200">ค่าโฆษณารายเดือน รวมทุกร้าน</h2>
              <p className="text-xs text-slate-500 mb-2">ยอดรวมทั้งหมดต่อเดือน ไม่แยกร้าน</p>
              <div style={{ width: '100%', height: 220 }}>
                {adsByStore.length === 0 ? (
                  <p className="text-slate-500 text-sm">ยังไม่มีข้อมูลค่าโฆษณา</p>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={adsByStore} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="monthLabel" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <Tooltip
                        contentStyle={tooltipStyle()} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle}
                        formatter={(value) => [`${Number(value).toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท`, 'ค่าโฆษณารวม']}
                      />
                      <Bar dataKey="total" fill="#fb923c" radius={[3, 3, 0, 0]} />
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
