
import { useEffect, useState, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function StatusBadge({ action }) {
  const styles = {
    'สั่งเพิ่ม': 'bg-red-500/20 text-red-400 border-red-500/40',
    'ปกติ': 'bg-teal-500/20 text-teal-400 border-teal-500/40',
    'ไม่เคลื่อนไหว': 'bg-slate-500/20 text-slate-400 border-slate-500/40',
  }
  return (
    <span className={`text-xs px-2 py-1 rounded-full border ${styles[action] || styles['ปกติ']}`}>
      {action}
    </span>
  )
}

function FreshBadge({ status }) {
  const styles = {
    'อัปเดตล่าสุด': 'bg-teal-500/20 text-teal-400',
    'ควรอัปเดต': 'bg-yellow-500/20 text-yellow-400',
    'ไม่อัปเดตนานมาก': 'bg-red-500/20 text-red-400',
    'ยังไม่มีข้อมูล': 'bg-slate-600/30 text-slate-500',
  }
  return <span className={`text-xs px-2 py-1 rounded-full ${styles[status] || ''}`}>{status}</span>
}

export default function Dashboard({ onNavigateDataEntry, onNavigateStockMonitoring, onNavigateFinanceMonitoring, onNavigatePricing, onNavigateImport, onNavigateHistory, onNavigateSkuManager, onNavigateRegionalMap }) {
  const { user, signOut } = useAuth()
  const [stock, setStock] = useState([])
  const [stores, setStores] = useState([])
  const [pl, setPl] = useState([])
  const [todayByStore, setTodayByStore] = useState([]) // ยอดขายวันนี้แยกร้าน
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [liveFlash, setLiveFlash] = useState(false) // กระพริบบอกว่าเพิ่งอัปเดตสด
  const flashTimer = useRef(null)

  async function loadAll() {
    const [stockRes, storesRes, plRes, todayRes] = await Promise.all([
      supabase.from('stock_status').select('*').order('code'),
      supabase.from('store_freshness').select('*').order('kind').order('name'),
      supabase.from('monthly_revenue_profit_unified').select('*').order('month', { ascending: false }).limit(12),
      supabase
        .from('movements')
        .select('qty, kind, store_id, stores(name, kind)')
        .eq('kind', 'out')
        .gte('moved_on', new Date().toISOString().slice(0, 10)),
    ])

    if (stockRes.error) setError(stockRes.error.message)
    setStock(stockRes.data || [])
    setStores(storesRes.data || [])
    setPl((plRes.data || []).slice().reverse()) // เรียงเก่า→ใหม่ ให้กราฟอ่านซ้ายไปขวาเป็นธรรมชาติ

    // รวมยอดขายวันนี้ (จำนวนชิ้น) แยกตามร้าน
    const byStore = {}
    for (const m of todayRes.data || []) {
      const name = m.stores?.name || 'คลังกลาง (ไม่ระบุร้าน)'
      const kind = m.stores?.kind
      if (!byStore[name]) byStore[name] = { name, kind, units: 0 }
      byStore[name].units += Math.abs(m.qty)
    }
    const arr = Object.values(byStore).sort((a, b) => b.units - a.units)
    setTodayByStore(arr)

    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    loadAll()

    // subscribe realtime บนตาราง movements — พอมีใครคีย์ข้อมูลใหม่ (ไม่ว่าจากเครื่องไหน)
    // จะโหลดข้อมูลทั้งหมดใหม่อัตโนมัติทันที ไม่ต้อง refresh เอง
    const channel = supabase
      .channel('movements-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movements' },
        () => {
          loadAll()
          setLiveFlash(true)
          clearTimeout(flashTimer.current)
          flashTimer.current = setTimeout(() => setLiveFlash(false), 1500)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      clearTimeout(flashTimer.current)
    }
  }, [])

  const needReorder = stock.filter((s) => s.action === 'สั่งเพิ่ม')
  const staleStores = stores.filter((s) => s.status === 'ไม่อัปเดตนานมาก' || s.status === 'ควรอัปเดต')

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-4 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            AlertWatch
            <span
              className={`w-2 h-2 rounded-full transition-colors ${liveFlash ? 'bg-teal-400' : 'bg-teal-600/40'}`}
              title="เชื่อมต่อแบบสด"
            />
          </h1>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
        <button onClick={signOut} className="text-xs text-slate-400 hover:text-red-400 transition">
          ออกจากระบบ
        </button>
      </header>

      <nav className="px-4 py-3 grid grid-cols-2 gap-2 max-w-3xl mx-auto border-b border-slate-800/60">
        <button
          onClick={onNavigateStockMonitoring}
          className="text-xs py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium transition"
        >
          📦 Stock Monitoring
        </button>
        <button
          onClick={onNavigateFinanceMonitoring}
          className="text-xs py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium transition"
        >
          💰 Finance Monitoring
        </button>
        <button
          onClick={onNavigatePricing}
          className="text-xs py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium transition"
        >
          ตั้งราคาขาย
        </button>
        <button
          onClick={onNavigateImport}
          className="text-xs py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium transition"
        >
          นำเข้ายอดเงิน Shopee
        </button>
        <button
          onClick={onNavigateDataEntry}
          className="text-xs py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium transition"
        >
          คีย์ข้อมูล
        </button>
        <button
          onClick={onNavigateHistory}
          className="text-xs py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium transition"
        >
          ประวัติรายการ (แก้ไข/ลบ)
        </button>
        <button
          onClick={onNavigateSkuManager}
          className="text-xs py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium transition"
        >
          จัดการสินค้า / ต้นทุน
        </button>
        <button
          onClick={onNavigateRegionalMap}
          className="col-span-2 text-xs py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium transition"
        >
          🗺️ แผนที่ยอดขายตามภาค / ฤดูกาล
        </button>
      </nav>

      <main className="p-4 space-y-6 max-w-3xl mx-auto">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg">
            โหลดข้อมูลไม่สำเร็จ: {error}
          </div>
        )}

        {loading ? (
          <p className="text-slate-500 text-sm">กำลังโหลด...</p>
        ) : (
          <>
            {/* สรุปด่วน */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <p className="text-xs text-slate-400">ต้องสั่งเพิ่ม</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{needReorder.length}</p>
                <p className="text-xs text-slate-500">SKU</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <p className="text-xs text-slate-400">ร้านยังไม่อัปเดตล่าสุด</p>
                <p className="text-2xl font-bold text-yellow-400 mt-1">{staleStores.length}</p>
                <p className="text-xs text-slate-500">ร้าน</p>
              </div>
            </div>

            {/* ยอดขายวันนี้แยกร้าน — อัปเดตสดทันทีที่มีคนคีย์ */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold text-slate-300">ยอดขายวันนี้แยกร้าน</h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 font-medium">LIVE</span>
              </div>
              {todayByStore.length === 0 ? (
                <p className="text-slate-500 text-sm bg-slate-800/50 rounded-lg p-3">ยังไม่มีการขายออกวันนี้</p>
              ) : (
                <div className="bg-slate-800 rounded-lg border border-slate-700 divide-y divide-slate-700">
                  {todayByStore.map((s) => {
                    const maxUnits = todayByStore[0]?.units || 1
                    const pct = Math.round((s.units / maxUnits) * 100)
                    return (
                      <div key={s.name} className="p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-sm">{s.name}</p>
                          <p className="text-sm font-semibold text-teal-400">{s.units} ชิ้น</p>
                        </div>
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* สต๊อกต้องสั่งเพิ่ม */}
            <section>
              <h2 className="text-sm font-semibold text-slate-300 mb-2">สต๊อกที่ต้องสั่งเพิ่ม</h2>
              {needReorder.length === 0 ? (
                <p className="text-slate-500 text-sm bg-slate-800/50 rounded-lg p-3">ไม่มีรายการที่ต้องสั่งเพิ่มตอนนี้</p>
              ) : (
                <div className="space-y-2">
                  {needReorder.map((s) => (
                    <div key={s.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.code} · เหลือ {s.on_hand} ชิ้น · คุ้มครอง {s.days_cover ?? '-'} วัน</p>
                      </div>
                      <StatusBadge action={s.action} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* สถานะสต๊อกทั้งหมด */}
            <section>
              <h2 className="text-sm font-semibold text-slate-300 mb-2">สถานะสต๊อกทั้งหมด</h2>
              <div className="bg-slate-800 rounded-lg border border-slate-700 divide-y divide-slate-700">
                {stock.map((s) => (
                  <div key={s.id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm">{s.name}</p>
                      <p className="text-xs text-slate-500">เหลือ {s.on_hand} · ขาย {s.per_day}/วัน</p>
                    </div>
                    <StatusBadge action={s.action} />
                  </div>
                ))}
              </div>
            </section>

            {/* สถานะการอัปเดตข้อมูลร้าน */}
            <section>
              <h2 className="text-sm font-semibold text-slate-300 mb-2">สถานะการอัปเดตข้อมูลร้าน (12 ร้าน)</h2>
              <div className="bg-slate-800 rounded-lg border border-slate-700 divide-y divide-slate-700">
                {stores.map((s) => (
                  <div key={s.id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.kind === 'own' ? 'ร้านตัวเอง' : 'ร้านเพื่อน'} · เช็คทุก {s.review_days} วัน</p>
                    </div>
                    <FreshBadge status={s.status} />
                  </div>
                ))}
              </div>
            </section>

            {/* รายได้และกำไรรายเดือน — ยึดวันที่ขายออกจริง รวมทั้งข้อมูลปัจจุบันและย้อนหลัง */}
            {pl.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-300 mb-2">รายได้และกำไรรายเดือน</h2>
                <p className="text-xs text-slate-500 mb-2">นับตามวันที่ขายออกจริง รวมข้อมูลปัจจุบันและย้อนหลังที่นำเข้าไว้</p>
                <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer>
                      <BarChart data={pl} margin={{ left: -15, right: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis
                          dataKey="month"
                          stroke="#94a3b8"
                          fontSize={10}
                          tickFormatter={(m) => new Date(m).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' })}
                        />
                        <YAxis domain={[(dataMin) => Math.min(0, dataMin), 'dataMax']} stroke="#64748b" fontSize={10} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                        <Tooltip
                          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12, color: '#ffffff' }}
                          labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                          itemStyle={{ color: '#ffffff' }}
                          labelFormatter={(m) => new Date(m).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })}
                          formatter={(value, name) => [`${Number(value).toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท`, name]}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === 'revenue' ? 'รายได้' : 'กำไร')} />
                        <Bar dataKey="revenue" fill="#2dd4bf" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="profit" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { Select } from '../components/FormFields'
import { REGIONS, PROVINCE_TO_REGION, SEASONS, MONTH_TO_SEASON } from '../lib/thailandRegions'

// รูปแผนที่ประเทศไทยแบบเสมือน (ไม่ได้อ้างอิงเส้นเขตแดนจริง) — จัดวาง 6 ภาคตามตำแหน่งคร่าวๆ
// เพื่อให้เห็นภาพรวมเชิงพื้นที่ได้ทันทีโดยไม่ต้องพึ่งข้อมูลภูมิศาสตร์ละเอียด
const REGION_SHAPES = {
  north: { d: 'M 70,15 C 100,5 140,10 155,35 C 168,55 165,80 145,100 C 125,120 90,125 65,105 C 45,88 45,55 58,35 C 62,25 65,20 70,15 Z', cx: 105, cy: 62 },
  northeast: { d: 'M 165,45 C 200,30 250,35 275,60 C 300,85 295,125 270,150 C 245,175 195,180 165,155 C 145,135 145,100 150,75 C 153,62 158,52 165,45 Z', cx: 213, cy: 105 },
  central: { d: 'M 100,110 C 130,100 165,105 180,125 C 195,145 190,175 170,195 C 150,215 115,215 95,195 C 78,178 75,150 85,130 C 90,120 95,114 100,110 Z', cx: 135, cy: 156 },
  east: { d: 'M 185,170 C 210,160 240,165 255,185 C 268,203 262,225 240,238 C 218,250 190,245 178,225 C 168,208 172,185 185,170 Z', cx: 216, cy: 204 },
  west: { d: 'M 55,110 C 72,105 85,115 90,135 C 95,160 88,200 80,240 C 73,275 65,300 55,315 C 45,300 40,260 42,220 C 44,180 45,140 55,110 Z', cx: 65, cy: 205 },
  south: { d: 'M 90,250 C 105,240 125,240 138,255 C 148,268 148,290 140,320 C 130,355 118,390 108,425 C 100,455 95,480 90,500 C 82,480 78,450 75,415 C 72,375 72,330 78,295 C 82,275 85,260 90,250 Z', cx: 110, cy: 355 },
}

function ThailandRegionMap({ regionTotals, maxValue }) {
  return (
    <svg viewBox="0 0 320 520" className="w-full max-w-xs mx-auto" style={{ aspectRatio: '320/520' }}>
      {REGIONS.map((r) => {
        const shape = REGION_SHAPES[r.key]
        const value = regionTotals[r.key] || 0
        const opacity = maxValue > 0 ? 0.22 + 0.68 * (value / maxValue) : 0.22
        return (
          <g key={r.key}>
            <path d={shape.d} fill={r.color} fillOpacity={opacity} stroke="#0f172a" strokeWidth="2" />
            <text x={shape.cx} y={shape.cy - 6} textAnchor="middle" className="fill-slate-100" style={{ fontSize: 12, fontWeight: 600 }}>
              {r.label}
            </text>
            <text x={shape.cx} y={shape.cy + 14} textAnchor="middle" className="fill-white" style={{ fontSize: 17, fontWeight: 700 }}>
              {value.toLocaleString('th-TH')}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function RegionalMap({ onBack }) {
  const [skus, setSkus] = useState([])
  const [selectedSku, setSelectedSku] = useState('') // '' = ทุกสินค้ารวมกัน
  const [selectedSeason, setSelectedSeason] = useState('') // '' = ทุกฤดู — ใช้กรองแผนที่ตอนเลือก SKU แล้ว
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('skus').select('id, code, name').order('code').then(({ data }) => setSkus(data || []))
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase.from('province_sales_agg').select('month, sku_id, customer_province, units')
      if (selectedSku) query = query.eq('sku_id', selectedSku)
      const { data } = await query
      setRows(data || [])
      setLoading(false)
    }
    load()
  }, [selectedSku])

  // เปลี่ยน SKU แล้วรีเซ็ตตัวกรองฤดูกาล กันค้างฤดูเดิมไว้โดยไม่ตั้งใจ
  useEffect(() => { setSelectedSeason('') }, [selectedSku])

  function seasonOf(monthStr) {
    return MONTH_TO_SEASON[Number(monthStr.slice(5, 7))]
  }

  // แผนที่ภาค — กรองตามฤดูที่เลือกด้วย (ถ้าเลือกไว้)
  const regionTotals = useMemo(() => {
    const totals = {}
    for (const r of rows) {
      if (selectedSeason && seasonOf(r.month) !== selectedSeason) continue
      const region = PROVINCE_TO_REGION[r.customer_province]
      if (!region) continue
      totals[region] = (totals[region] || 0) + Number(r.units)
    }
    return totals
  }, [rows, selectedSeason])

  const maxRegionValue = Math.max(0, ...Object.values(regionTotals))

  // ยอดตามฤดูกาลของสินค้าที่เลือก (แสดงเป็นกราฟแท่ง) — ไม่กรองตามภาค นับรวมทุกภาค
  const seasonChartData = useMemo(() => {
    const totals = { summer: 0, rainy: 0, winter: 0 }
    for (const r of rows) {
      const season = seasonOf(r.month)
      if (season) totals[season] += Number(r.units)
    }
    return SEASONS.map((s) => ({ label: s.label.split(' ')[0], value: totals[s.key] }))
  }, [rows])

  // ตาราง ภาค × ฤดู ของสินค้าที่เลือก — ให้เห็นครบทุกช่องพร้อมกัน ไม่ต้องสลับตัวกรองทีละฤดู
  const regionSeasonMatrix = useMemo(() => {
    if (!selectedSku) return null
    const matrix = {}
    for (const r of REGIONS) matrix[r.key] = { summer: 0, rainy: 0, winter: 0 }
    for (const row of rows) {
      const region = PROVINCE_TO_REGION[row.customer_province]
      const season = seasonOf(row.month)
      if (!region || !season) continue
      matrix[region][season] += Number(row.units)
    }
    return matrix
  }, [rows, selectedSku])

  // ตอนดูภาพรวมทุกสินค้า: สินค้าขายดีสุดของแต่ละฤดูกาล
  const topBySeason = useMemo(() => {
    if (selectedSku) return null
    const skuMap = new Map(skus.map((s) => [s.id, s]))
    const bucket = { summer: new Map(), rainy: new Map(), winter: new Map() }
    for (const r of rows) {
      const month = Number(r.month.slice(5, 7))
      const season = MONTH_TO_SEASON[month]
      if (!season) continue
      const m = bucket[season]
      m.set(r.sku_id, (m.get(r.sku_id) || 0) + Number(r.units))
    }
    const result = {}
    for (const s of SEASONS) {
      result[s.key] = [...bucket[s.key].entries()]
        .map(([sku_id, units]) => ({ sku: skuMap.get(sku_id), units }))
        .filter((x) => x.sku)
        .sort((a, b) => b.units - a.units)
        .slice(0, 5)
    }
    return result
  }, [rows, selectedSku, skus])

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-4 flex items-center gap-3 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <button onClick={onBack} className="text-slate-400 hover:text-teal-400 transition text-sm">
          ← กลับ
        </button>
        <h1 className="text-lg font-bold">แผนที่ยอดขายตามภาค</h1>
      </header>

      <main className="p-4 space-y-4 max-w-md mx-auto">
        <Select
          label="สินค้า"
          value={selectedSku}
          onChange={setSelectedSku}
          placeholder="ทุกสินค้ารวมกัน"
          options={skus.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
        />

        {loading ? (
          <p className="text-slate-500 text-sm">กำลังโหลด...</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-500 text-sm bg-slate-800/50 rounded-lg p-3">ไม่มีข้อมูลจังหวัดสำหรับเงื่อนไขนี้</p>
        ) : (
          <>
            <section className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <p className="text-xs text-slate-500 mb-2">แผนที่เป็นแบบเสมือน (ไม่ใช่เส้นเขตแดนจริง) ใช้แค่บอกตำแหน่งภาคคร่าวๆ</p>

              {selectedSku && (
                <div className="flex gap-1.5 mb-3">
                  {[{ key: '', label: 'ทุกฤดู' }, ...SEASONS.map((s) => ({ key: s.key, label: s.label.split(' ')[0] }))].map((opt) => (
                    <button
                      key={opt.key || 'all'}
                      onClick={() => setSelectedSeason(opt.key)}
                      className={`flex-1 text-xs py-1.5 rounded-lg transition ${
                        selectedSeason === opt.key ? 'bg-teal-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              <ThailandRegionMap regionTotals={regionTotals} maxValue={maxRegionValue} />
            </section>

            {selectedSku && regionSeasonMatrix && (
              <section className="bg-slate-800 rounded-xl p-4 border border-slate-700 overflow-x-auto">
                <h2 className="text-sm font-semibold text-slate-200 mb-3">ตารางภาค × ฤดูกาล (ชิ้น)</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs border-b border-slate-700">
                      <th className="text-left py-1.5 font-normal">ภาค</th>
                      {SEASONS.map((s) => (
                        <th key={s.key} className="text-right py-1.5 font-normal">{s.label.split(' ')[0]}</th>
                      ))}
                      <th className="text-right py-1.5 font-normal">รวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {REGIONS.map((r) => {
                      const row = regionSeasonMatrix[r.key]
                      const total = row.summer + row.rainy + row.winter
                      return (
                        <tr key={r.key}>
                          <td className="py-1.5 text-slate-300">{r.label}</td>
                          <td className="text-right py-1.5 text-slate-300">{row.summer || '–'}</td>
                          <td className="text-right py-1.5 text-slate-300">{row.rainy || '–'}</td>
                          <td className="text-right py-1.5 text-slate-300">{row.winter || '–'}</td>
                          <td className="text-right py-1.5 font-medium text-teal-400">{total || '–'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            )}

            {selectedSku ? (
              <section className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <h2 className="text-sm font-semibold text-slate-200 mb-3">ยอดขายตามฤดูกาล</h2>
                <div style={{ width: '100%', height: 160 }}>
                  <ResponsiveContainer>
                    <BarChart data={seasonChartData} margin={{ left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                      <YAxis domain={[(dataMin) => Math.min(0, dataMin), 'dataMax']} stroke="#64748b" fontSize={11} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12, color: '#ffffff' }}
                          labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                          itemStyle={{ color: '#ffffff' }}
                        formatter={(value) => [`${value} ชิ้น`, 'ขายแล้ว']}
                      />
                      <Bar dataKey="value" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            ) : (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-300">สินค้าขายดีตามฤดูกาล</h2>
                {SEASONS.map((s) => (
                  <div key={s.key} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <p className="text-sm font-medium">ฤดู{s.label}</p>
                    </div>
                    {topBySeason?.[s.key]?.length ? (
                      <div className="divide-y divide-slate-700">
                        {topBySeason[s.key].map((item, i) => (
                          <div key={item.sku.id} className="px-3 py-2 flex items-center justify-between">
                            <p className="text-sm text-slate-300">
                              <span className="text-slate-500 mr-1.5">{i + 1}.</span>
                              {item.sku.code} — {item.sku.name}
                            </p>
                            <p className="text-sm font-medium text-teal-400">{item.units} ชิ้น</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="px-3 py-2 text-sm text-slate-500">ไม่มีข้อมูล</p>
                    )}
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

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
    color: '#ffffff',
  }
}

// Recharts ไม่ไล่สีจาก contentStyle ลงไปที่ label/item เอง ต้องกำหนดแยกให้อ่านออกบนพื้นหลังเข้ม
const tooltipLabelStyle = { color: '#ffffff', fontWeight: 600 }
const tooltipItemStyle = { color: '#ffffff' }

export default function StockMonitoring({ onBack }) {
  const [stock, setStock] = useState([])
  const [repairStatus, setRepairStatus] = useState([])
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
      const [stockRes, repairRes] = await Promise.all([
        supabase.from('stock_status').select('*').order('code'),
        supabase.from('sku_repair_status').select('*').order('currently_in_repair', { ascending: false }),
      ])
      if (stockRes.error) setError(stockRes.error.message)
      setStock(stockRes.data || [])
      setRepairStatus((repairRes.data || []).filter((r) => r.currently_in_repair > 0))
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
        .from('province_sales_agg')
        .select('customer_province, units')

      if (provinceSku) query = query.eq('sku_id', provinceSku)
      if (provinceMonth !== 'all') {
        query = query.eq('month', `${provinceMonth}-01`)
      }

      const { data, error } = await query
      if (error) {
        setProvinceData([])
        setProvinceLoading(false)
        return
      }

      const unitsByProvince = {}
      for (const m of data || []) {
        unitsByProvince[m.customer_province] = (unitsByProvince[m.customer_province] || 0) + Number(m.units)
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
      const kindLabel = { in: 'รับเข้า', out: 'ขายออก', return: 'ตีกลับ', adjust: 'ปรับปรุงยอด', lost: 'ของหาย/ส่งเกิน', repair_out: 'ส่งซ่อม', repair_in: 'รับคืนจากซ่อม' }
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
        .from('province_sales_agg')
        .select('month, sku_id, customer_province, units')
        .order('month', { ascending: false }),
      supabase.from('skus').select('id, code, name'),
    ])

    if (salesRes.error) {
      alert('ดึงข้อมูลไม่สำเร็จ: ' + salesRes.error.message)
    } else {
      const skuMap = new Map((skuRes.data || []).map((s) => [s.id, s]))
      const rows = (salesRes.data || [])
        .map((r) => {
          const sku = skuMap.get(r.sku_id)
          return {
            เดือน: r.month.slice(0, 7),
            รหัสสินค้า: sku?.code || '',
            ชื่อสินค้า: sku?.name || '',
            จังหวัด: r.customer_province,
            ปริมาณ_ชิ้น: Number(r.units),
          }
        })
        .sort((a, b) => {
        if (a.เดือน !== b.เดือน) return b.เดือน.localeCompare(a.เดือน)
        if (a.รหัสสินค้า !== b.รหัสสินค้า) return a.รหัสสินค้า.localeCompare(b.รหัสสินค้า)
        return b.ปริมาณ_ชิ้น - a.ปริมาณ_ชิ้น
      })
      exportToCsv(`ยอดขายตามจังหวัด_${todayStamp()}.csv`, rows)
    }
    setExportBusy('')
  }

  const pieData = stock.filter((s) => s.on_hand > 0).sort((a, b) => b.on_hand - a.on_hand).map((s) => ({ name: s.code, value: s.on_hand }))

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

        {repairStatus.length > 0 && (
          <section className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/30">
            <h2 className="text-sm font-semibold text-orange-400 mb-1">🔧 สินค้ารอซ่อม</h2>
            <p className="text-xs text-orange-400/70 mb-3">จำนวนนี้ถูกหักออกจากสต๊อกที่ขายได้แล้ว จนกว่าจะคีย์ "รับคืนจากซ่อม"</p>
            <div className="divide-y divide-orange-500/20">
              {repairStatus.map((r) => (
                <div key={r.sku_id} className="py-1.5 flex items-center justify-between">
                  <p className="text-sm text-slate-200">{r.code} — {r.name}</p>
                  <p className="text-sm font-medium text-orange-400">{r.currently_in_repair} ชิ้น</p>
                </div>
              ))}
            </div>
          </section>
        )}

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
                  <XAxis type="number" stroke="#64748b" fontSize={11} domain={[0, 'dataMax']} />
                  <YAxis type="category" dataKey="code" stroke="#94a3b8" fontSize={10} width={150} interval={0} />
                  <Tooltip
                    contentStyle={tooltipStyle()} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle}
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
                  <XAxis type="number" stroke="#64748b" fontSize={11} domain={[0, 'dataMax']} />
                  <YAxis type="category" dataKey="code" stroke="#94a3b8" fontSize={10} width={150} interval={0} />
                  <Tooltip
                    contentStyle={tooltipStyle()} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle}
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
            <ChartCard
              title="สัดส่วนสต็อกตาม SKU"
              subtitle="เทียบเป็น % ของจำนวนชิ้นคงเหลือทั้งหมด (เฉพาะสินค้าที่มีสต๊อก) — แตะแต่ละชิ้นเพื่อดูตัวเลข"
              height={440}
            >
              {pieData.length === 0 ? (
                <p className="text-slate-500 text-sm">ยังไม่มีสต๊อกคงเหลือ</p>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="42%"
                      outerRadius={130}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={STORE_COLORS[i % STORE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle()} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(value) => [`${value} ชิ้น`]} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} layout="horizontal" />
                  </PieChart>
                </ResponsiveContainer>
              )}
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
                      <XAxis type="number" stroke="#64748b" fontSize={11} domain={[0, 'dataMax']} />
                      <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={90} />
                      <Tooltip contentStyle={tooltipStyle()} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(value) => [`${value} ชิ้น`, 'ขายแล้ว']} />
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
                      <XAxis type="number" stroke="#64748b" fontSize={11} domain={[0, 'dataMax']} />
                      <YAxis type="category" dataKey="province" stroke="#94a3b8" fontSize={11} width={90} />
                      <Tooltip contentStyle={tooltipStyle()} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(value) => [`${value} ชิ้น`, 'ขายแล้ว']} />
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
                <YAxis domain={[(dataMin) => Math.min(0, dataMin), 'dataMax']} stroke="#64748b" fontSize={10} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
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
                <YAxis domain={[(dataMin) => Math.min(0, dataMin), 'dataMax']} stroke="#64748b" fontSize={10} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
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
            <XAxis
              type="number"
              stroke="#64748b"
              fontSize={10}
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              domain={[(dataMin) => Math.min(0, dataMin), 'dataMax']}
            />
            <YAxis type="category" dataKey="code" stroke="#94a3b8" fontSize={10} width={150} interval={0} />
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
  const [accountMonthly, setAccountMonthly] = useState([])
  const [accountRecent, setAccountRecent] = useState([])
  // ช่วงวันที่สำหรับ export รายละเอียดบัญชี — ค่าเริ่มต้นคือต้นปีนี้ถึงวันนี้
  const [acctFrom, setAcctFrom] = useState(new Date().getFullYear() + '-01-01')
  const [acctTo, setAcctTo] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportBusy, setExportBusy] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [skuRes, rpRes, costRes, plRes, adsRes, acctMonthRes, acctRecentRes] = await Promise.all([
        supabase.from('skus').select('id, code, name').order('code'),
        supabase.from('sku_monthly_finance').select('month, sku_id, revenue, profit'),
        supabase.from('sku_monthly_cost').select('month, sku_id, cost'),
        supabase.from('monthly_revenue_profit_unified').select('*').order('month', { ascending: true }).limit(24),
        supabase.from('monthly_ads_by_store').select('*').order('month', { ascending: true }),
        supabase.from('account_monthly_summary').select('*').order('month', { ascending: false }).limit(24),
        supabase.from('account_entries').select('id, entry_date, description, amount, direction, category')
          .order('entry_date', { ascending: false }).order('id', { ascending: false }).limit(30),
      ])
      if (rpRes.error) setError(rpRes.error.message)
      setSkus(skuRes.data || [])
      setAccountMonthly(acctMonthRes.data || [])
      setAccountRecent(acctRecentRes.data || [])
      // เปลี่ยนชื่อฟิลด์ month -> date ให้ตรงกับที่ฟังก์ชัน aggregate ด้านบนคาดไว้ (ข้อมูลเป็นรายเดือนอยู่แล้วจากฝั่ง DB)
      setRevenueProfitRows((rpRes.data || []).map((r) => ({ ...r, date: r.month })))
      setCostRows((costRes.data || []).map((r) => ({ ...r, date: r.month })))
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

  async function exportAccountEntries() {
    if (acctFrom > acctTo) {
      alert('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด')
      return
    }
    setExportBusy('account')
    const { data, error } = await supabase
      .from('account_entries')
      .select('entry_date, description, amount, direction, category, note')
      .gte('entry_date', acctFrom)
      .lte('entry_date', acctTo)
      .order('entry_date', { ascending: true })

    if (error) {
      alert('ดึงข้อมูลไม่สำเร็จ: ' + error.message)
    } else if ((data || []).length === 0) {
      alert('ไม่มีรายการบัญชีในช่วงวันที่ที่เลือก')
    } else {
      exportToCsv(`รายละเอียดบัญชี_${acctFrom}_ถึง_${acctTo}.csv`, (data || []).map((r) => ({
        วันที่: r.entry_date,
        รายละเอียด: r.description,
        ประเภท: r.direction === 'income' ? 'รายรับ' : 'รายจ่าย',
        รายรับ: r.direction === 'income' ? r.amount : '',
        รายจ่าย: r.direction === 'expense' ? r.amount : '',
        หมวดหมู่: r.category || '',
        หมายเหตุ: r.note || '',
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

            {/* บัญชีบริษัท — รายรับรายจ่ายที่ไม่เกี่ยวกับการขายโดยตรง */}
            <section className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <h2 className="text-sm font-semibold text-slate-200">บัญชีบริษัท (รายรับ-รายจ่ายอื่น)</h2>
              <p className="text-xs text-slate-500 mb-3">
                รายการที่ไม่เกี่ยวกับการขายสินค้าโดยตรง — ไม่ถูกนำไปรวมในกำไรจากสินค้าด้านบน
              </p>

              {accountMonthly.length === 0 ? (
                <p className="text-slate-500 text-sm">
                  ยังไม่มีรายการบัญชี — เริ่มคีย์ได้ที่หน้าคีย์ข้อมูล → บัญชี
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-500 text-xs border-b border-slate-700">
                          <th className="text-left py-1.5 font-normal">เดือน</th>
                          <th className="text-right py-1.5 font-normal">รายรับ</th>
                          <th className="text-right py-1.5 font-normal">รายจ่าย</th>
                          <th className="text-right py-1.5 font-normal">สุทธิ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/60">
                        {accountMonthly.map((m) => (
                          <tr key={m.month}>
                            <td className="py-1.5 text-slate-300">
                              {new Date(m.month).toLocaleDateString('th-TH', { year: '2-digit', month: 'short' })}
                            </td>
                            <td className="text-right py-1.5 text-teal-400">
                              {Number(m.income) ? Number(m.income).toLocaleString('th-TH', { maximumFractionDigits: 0 }) : '–'}
                            </td>
                            <td className="text-right py-1.5 text-red-400">
                              {Number(m.expense) ? Number(m.expense).toLocaleString('th-TH', { maximumFractionDigits: 0 }) : '–'}
                            </td>
                            <td className={`text-right py-1.5 font-medium ${Number(m.net) >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                              {Number(m.net).toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {accountRecent.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-slate-400 mb-1.5">รายการล่าสุด</p>
                      <div className="divide-y divide-slate-700/60 max-h-64 overflow-y-auto">
                        {accountRecent.map((r) => (
                          <div key={r.id} className="py-1.5 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm text-slate-300 truncate">{r.description}</p>
                              <p className="text-[11px] text-slate-500">
                                {r.entry_date}{r.category && ` · ${r.category}`}
                              </p>
                            </div>
                            <p className={`text-sm flex-shrink-0 ${r.direction === 'income' ? 'text-teal-400' : 'text-red-400'}`}>
                              {r.direction === 'income' ? '+' : '-'}{Number(r.amount).toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="mt-4 pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-400 mb-2">Export รายละเอียดบัญชีตามช่วงวันที่</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[11px] text-slate-500">ตั้งแต่วันที่</label>
                    <input
                      type="date"
                      value={acctFrom}
                      onChange={(e) => setAcctFrom(e.target.value)}
                      className="w-full mt-1 px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500">ถึงวันที่</label>
                    <input
                      type="date"
                      value={acctTo}
                      onChange={(e) => setAcctTo(e.target.value)}
                      className="w-full mt-1 px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
                <button
                  onClick={exportAccountEntries}
                  disabled={exportBusy !== ''}
                  className="w-full text-sm py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium transition disabled:opacity-50"
                >
                  {exportBusy === 'account' ? 'กำลังเตรียมไฟล์...' : '📒 Export รายละเอียดบัญชี (CSV)'}
                </button>
              </div>
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
                      <YAxis domain={[(dataMin) => Math.min(0, dataMin), 'dataMax']} stroke="#64748b" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
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
                      <YAxis domain={[(dataMin) => Math.min(0, dataMin), 'dataMax']} stroke="#64748b" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
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
