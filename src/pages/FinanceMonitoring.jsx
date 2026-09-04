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

const STORE_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#4ade80', '#facc15', '#f87171', '#94a3b8']

export default function FinanceMonitoring({ onBack }) {
  const [monthly, setMonthly] = useState([])
  const [adsByStore, setAdsByStore] = useState([])
  const [storeKeys, setStoreKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportBusy, setExportBusy] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      // รายได้+กำไรรายเดือน รวมทั้งข้อมูลปัจจุบัน (movements/payouts) และย้อนหลังที่นำเข้า (historical_sales)
      // นับตามวันที่ขายออกจริง
      const [plRes, adsRes] = await Promise.all([
        supabase.from('monthly_revenue_profit_unified').select('*').order('month', { ascending: true }).limit(24),
        supabase.from('monthly_ads_by_store').select('*').order('month', { ascending: true }),
      ])
      if (plRes.error) setError(plRes.error.message)
      setMonthly((plRes.data || []).map((m) => ({
        ...m,
        monthLabel: new Date(m.month).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
      })))

      // pivot ค่าโฆษณารายเดือน-ต่อร้าน ให้เป็นแถวเดียวต่อเดือน มีคอลัมน์แยกตามชื่อร้าน (สำหรับกราฟแยกร้าน)
      const stores = [...new Set((adsRes.data || []).map((r) => r.store_name))]
      const byMonth = new Map()
      for (const r of adsRes.data || []) {
        if (!byMonth.has(r.month)) {
          byMonth.set(r.month, {
            month: r.month,
            monthLabel: new Date(r.month).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
            total: 0,
          })
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
            <button
              onClick={exportAdsSpend}
              disabled={exportBusy !== ''}
              className="text-sm py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition disabled:opacity-50 text-left px-3"
            >
              {exportBusy === 'ads' ? 'กำลังเตรียมไฟล์...' : '📣 ค่าโฆษณารายสัปดาห์ทั้งหมด'}
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

            {/* ค่าโฆษณารายเดือน แยกตามร้าน */}
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
                        contentStyle={tooltipStyle()}
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

            {/* ค่าโฆษณารายเดือน รวมทุกร้าน */}
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
                        contentStyle={tooltipStyle()}
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
