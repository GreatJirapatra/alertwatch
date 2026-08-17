import { useEffect, useState } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Legend,
} from 'recharts'
import { supabase } from '../lib/supabase'

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

export default function Monitoring({ onBack }) {
  const [stock, setStock] = useState([])
  const [pl, setPl] = useState([])
  const [storeSales, setStoreSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)

      const [stockRes, plRes, storesRes, movementsRes] = await Promise.all([
        supabase.from('stock_status').select('*').order('code'),
        supabase.from('monthly_pl').select('*').order('month', { ascending: true }).limit(6),
        supabase.from('stores').select('id, name, kind').eq('active', true),
        supabase.from('movements').select('store_id, qty, kind, unit_cost, moved_on').eq('kind', 'out'),
      ])

      if (stockRes.error) setError(stockRes.error.message)

      setStock(stockRes.data || [])
      setPl((plRes.data || []).map((m) => ({
        ...m,
        monthLabel: new Date(m.month).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
      })))

      // รวมยอดขาย (บาท) ต่อร้าน จาก movements kind=out (qty ติดลบ * unit_cost คือ COGS ไม่ใช่ยอดขาย
      // แต่เราไม่มีราคาขายผูกกับ movement โดยตรง ใช้จำนวนชิ้นขายแทนเป็นตัวเปรียบเทียบ)
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

      setLoading(false)
    }
    load()
  }, [])

  const pieData = stock.map((s) => ({ name: s.code, value: s.on_hand }))

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-4 flex items-center gap-3 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <button onClick={onBack} className="text-slate-400 hover:text-teal-400 transition text-sm">
          ← กลับ
        </button>
        <h1 className="text-lg font-bold">Monitoring</h1>
      </header>

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

            {/* 3. กำไรสุทธิรายเดือน */}
            <ChartCard title="กำไรสุทธิรายเดือน" subtitle="บาท ต่อเดือน (6 เดือนล่าสุดที่มีข้อมูล)">
              {pl.length === 0 ? (
                <p className="text-slate-500 text-sm">ยังไม่มีข้อมูลกำไร/ขาดทุนรายเดือน</p>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={pl} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="monthLabel" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip
                      contentStyle={tooltipStyle()}
                      formatter={(value) => [`${Number(value).toLocaleString('th-TH')} บาท`, 'กำไรสุทธิ']}
                    />
                    <Bar dataKey="net_profit" radius={[4, 4, 0, 0]}>
                      {pl.map((row, i) => (
                        <Cell key={i} fill={row.net_profit >= 0 ? '#14b8a6' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* 4. เปรียบเทียบยอดขายรายร้าน */}
            <ChartCard
              title="ยอดขายรายร้าน (จำนวนชิ้น)"
              subtitle="รวมยอดขายทุก SKU ต่อร้าน — เทียบสัดส่วนการเคลื่อนไหว"
              height={Math.max(200, storeSales.length * 40)}
            >
              {storeSales.length === 0 ? (
                <p className="text-slate-500 text-sm">ยังไม่มีข้อมูลยอดขายผูกกับร้าน</p>
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
            </ChartCard>
          </>
        )}
      </main>
    </div>
  )
}
