import { useEffect, useState, useRef } from 'react'
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

export default function Dashboard({ onNavigateDataEntry, onNavigateMonitoring, onNavigatePricing, onNavigateImport, onNavigateHistory, onNavigateSkuManager, onNavigateRegionalMap }) {
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
      supabase.from('monthly_pl').select('*').limit(3),
      supabase
        .from('movements')
        .select('qty, kind, store_id, stores(name, kind)')
        .eq('kind', 'out')
        .gte('moved_on', new Date().toISOString().slice(0, 10)),
    ])

    if (stockRes.error) setError(stockRes.error.message)
    setStock(stockRes.data || [])
    setStores(storesRes.data || [])
    setPl(plRes.data || [])

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
          onClick={onNavigateMonitoring}
          className="text-xs py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium transition"
        >
          Monitoring
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

            {/* กำไรขาดทุนรายเดือน */}
            {pl.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-300 mb-2">กำไรสุทธิรายเดือน (3 เดือนล่าสุด)</h2>
                <p className="text-xs text-slate-500 mb-2">นับกำไรตามเดือนที่เงินเข้าจริง จับคู่กับต้นทุนของออเดอร์เดียวกัน</p>
                <div className="bg-slate-800 rounded-lg border border-slate-700 divide-y divide-slate-700">
                  {pl.map((m) => (
                    <div key={m.month} className="p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm">{new Date(m.month).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })}</p>
                        <p className={`text-sm font-medium ${m.net_profit >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                          {m.net_profit?.toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท
                        </p>
                      </div>
                      {(m.unmatched_cogs > 0 || m.unmatched_received > 0) && (
                        <p className="text-xs text-yellow-400/80 mt-1">
                          ⚠ ยังไม่รวม: ต้นทุนที่ยังไม่รู้ผล {(m.unmatched_cogs || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท
                          {m.unmatched_received > 0 && ` · เงินเข้าที่ยังไม่ผูกออเดอร์ ${m.unmatched_received.toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
