import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from '../lib/supabase'
import { exportToCsv, todayStamp } from '../lib/csvExport'

function tooltipStyle() {
  return {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 8,
    fontSize: 12,
    color: '#e2e8f0',
  }
}

export default function FinanceMonitoring({ onBack }) {
  const [monthly, setMonthly] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportBusy, setExportBusy] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      // รายได้+กำไรรายเดือน รวมทั้งข้อมูลปัจจุบัน (movements/payouts) และย้อนหลังที่นำเข้า (historical_sales)
      // นับตามวันที่ขายออกจริง
      const { data, error } = await supabase
        .from('monthly_revenue_profit_unified')
        .select('*')
        .order('month', { ascending: true })
        .limit(24)
      if (error) setError(error.message)
      setMonthly((data || []).map((m) => ({
        ...m,
        monthLabel: new Date(m.month).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
      })))
      setLoading(false)
    }
    load()
  }, [])

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

  const totalRevenue = monthly.reduce((s, m) => s + Number(m.revenue || 0), 0)
  const totalProfit = monthly.reduce((s, m) => s + Number(m.profit || 0), 0)

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
          </div>
        </section>

        {monthly.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400">รายได้รวม ({monthly.length} เดือน)</p>
              <p className="text-xl font-bold mt-1 text-teal-400">฿{totalRevenue.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400">กำไรรวม ({monthly.length} เดือน)</p>
              <p className={`text-xl font-bold mt-1 ${totalProfit >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                ฿{totalProfit.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-slate-500 text-sm">กำลังโหลด...</p>
        ) : monthly.length === 0 ? (
          <p className="text-slate-500 text-sm bg-slate-800/50 rounded-lg p-3">ยังไม่มีข้อมูลรายได้/กำไร</p>
        ) : (
          <>
            {/* รายได้และกำไรรายเดือน */}
            <section className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <h2 className="text-sm font-semibold text-slate-200">รายได้และกำไรรายเดือน</h2>
              <p className="text-xs text-slate-500 mb-2">นับตามวันที่ขายออกจริง รวมข้อมูลปัจจุบันและย้อนหลัง</p>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={monthly} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="monthLabel" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip
                      contentStyle={tooltipStyle()}
                      formatter={(value, name) => [`${Number(value).toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === 'revenue' ? 'รายได้' : 'กำไร')} />
                    <Bar dataKey="revenue" fill="#2dd4bf" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="profit" radius={[3, 3, 0, 0]}>
                      {monthly.map((m, i) => (
                        <Cell key={i} fill={m.profit >= 0 ? '#a78bfa' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* ตารางรายเดือน */}
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
          </>
        )}
      </main>
    </div>
  )
}
