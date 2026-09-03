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
      let query = supabase.from('province_sales_unified').select('sold_on, qty, customer_province, sku_id')
      if (selectedSku) query = query.eq('sku_id', selectedSku)
      const { data } = await query
      setRows(data || [])
      setLoading(false)
    }
    load()
  }, [selectedSku])

  // เปลี่ยน SKU แล้วรีเซ็ตตัวกรองฤดูกาล กันค้างฤดูเดิมไว้โดยไม่ตั้งใจ
  useEffect(() => { setSelectedSeason('') }, [selectedSku])

  function seasonOf(sold_on) {
    return MONTH_TO_SEASON[Number(sold_on.slice(5, 7))]
  }

  // แผนที่ภาค — กรองตามฤดูที่เลือกด้วย (ถ้าเลือกไว้)
  const regionTotals = useMemo(() => {
    const totals = {}
    for (const r of rows) {
      if (selectedSeason && seasonOf(r.sold_on) !== selectedSeason) continue
      const region = PROVINCE_TO_REGION[r.customer_province]
      if (!region) continue
      totals[region] = (totals[region] || 0) + Math.abs(r.qty)
    }
    return totals
  }, [rows, selectedSeason])

  const maxRegionValue = Math.max(0, ...Object.values(regionTotals))

  // ยอดตามฤดูกาลของสินค้าที่เลือก (แสดงเป็นกราฟแท่ง) — ไม่กรองตามภาค นับรวมทุกภาค
  const seasonChartData = useMemo(() => {
    const totals = { summer: 0, rainy: 0, winter: 0 }
    for (const r of rows) {
      const season = seasonOf(r.sold_on)
      if (season) totals[season] += Math.abs(r.qty)
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
      const season = seasonOf(row.sold_on)
      if (!region || !season) continue
      matrix[region][season] += Math.abs(row.qty)
    }
    return matrix
  }, [rows, selectedSku])

  // ตอนดูภาพรวมทุกสินค้า: สินค้าขายดีสุดของแต่ละฤดูกาล
  const topBySeason = useMemo(() => {
    if (selectedSku) return null
    const skuMap = new Map(skus.map((s) => [s.id, s]))
    const bucket = { summer: new Map(), rainy: new Map(), winter: new Map() }
    for (const r of rows) {
      const month = Number(r.sold_on.slice(5, 7))
      const season = MONTH_TO_SEASON[month]
      if (!season) continue
      const m = bucket[season]
      m.set(r.sku_id, (m.get(r.sku_id) || 0) + Math.abs(r.qty))
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
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
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
