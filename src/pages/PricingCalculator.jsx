import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Select, Input } from '../components/FormFields'

function toNum(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export default function PricingCalculator({ onBack }) {
  const [skus, setSkus] = useState([])
  const [skuId, setSkuId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [stockInfo, setStockInfo] = useState(null) // ข้อมูลอัตราหมุนของ SKU ที่กำลังเลือก

  // ค่าที่ปรับได้ในเครื่องคำนวณ
  const [landedCost, setLandedCost] = useState('')
  const [feePct, setFeePct] = useState(27)
  const [adsPct, setAdsPct] = useState(10)
  const [affiliatePct, setAffiliatePct] = useState(10)
  const [affiliateAttach, setAffiliateAttach] = useState(40)
  const [targetMargin, setTargetMargin] = useState(20)
  const [minMargin, setMinMargin] = useState(12)
  const [competitorPrice, setCompetitorPrice] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')

  useEffect(() => {
    supabase.from('skus').select('*').eq('active', true).order('code')
      .then(({ data }) => { setSkus(data || []); setLoading(false) })
  }, [])

  async function loadSku(id) {
    setSkuId(id)
    const s = skus.find((x) => x.id === id)
    if (!s) return
    const landed = s.cost_currency === 'THB'
      ? s.cost_amount + s.shipping_per_unit
      : s.cost_amount * s.fx_rate + s.shipping_per_unit
    setLandedCost(landed.toFixed(2))
    setAdsPct((s.ads_pct * 100).toFixed(1))
    setAffiliatePct((s.affiliate_pct * 100).toFixed(1))
    setAffiliateAttach((s.affiliate_attach * 100).toFixed(1))
    setTargetMargin((s.target_margin * 100).toFixed(1))
    setMinMargin((s.min_margin * 100).toFixed(1))
    setCompetitorPrice(s.competitor_price ?? '')
    setCurrentPrice(s.current_price ?? '')

    // ดึงอัตราการหมุนสต๊อกของ SKU นี้มาแสดงคู่กับการตั้งราคา
    const { data: stock } = await supabase.from('stock_status').select('*').eq('id', id).single()
    setStockInfo(stock || null)
  }

  // --- คำนวณ ---
  const cost = toNum(landedCost)
  const fee = toNum(feePct) / 100
  const ads = toNum(adsPct) / 100
  const aff = toNum(affiliatePct) / 100
  const attach = toNum(affiliateAttach) / 100
  const target = toNum(targetMargin) / 100
  const minM = toNum(minMargin) / 100

  // ต้นทุน affiliate ที่ใช้ในสูตรคือค่าคาดหวัง = aff% x สัดส่วนออเดอร์ที่มาจาก affiliate
  const affExpected = aff * attach

  // ราคาขายที่ควรตั้ง = ต้นทุน / (1 - fee - ads - affExpected - target)
  const denomTarget = 1 - fee - ads - affExpected - target
  const suggestedPrice = denomTarget > 0 ? cost / denomTarget : null

  // กำไรจริงถ้าตั้งราคาปัจจุบัน (ราคาขาย - fee - ads - ต้นทุน) แยก 2 เคส: ออเดอร์ปกติ vs ออเดอร์ affiliate
  function marginAt(price) {
    if (!price) return null
    const normalProfit = price * (1 - fee - ads) - cost
    const affProfit = price * (1 - fee - ads - aff) - cost
    return {
      normalPct: (normalProfit / price) * 100,
      affPct: (affProfit / price) * 100,
      blendedPct: ((normalProfit * (1 - attach) + affProfit * attach) / price) * 100,
    }
  }
  const currentMargins = marginAt(toNum(currentPrice))

  // เช็คความอยู่รอด: เทียบราคาที่ต้องตั้ง (ให้ได้ min margin) กับราคาคู่แข่ง
  const denomMin = 1 - fee - ads - affExpected - minM
  const minViablePrice = denomMin > 0 ? cost / denomMin : null
  const comp = toNum(competitorPrice, null)
  let survival = null
  if (minViablePrice && comp) {
    if (comp >= (suggestedPrice ?? minViablePrice)) {
      survival = { level: 'ok', text: 'ตั้งราคาเป้าหมาย 20% ได้ และยังต่ำกว่าหรือเท่าคู่แข่ง' }
    } else if (comp >= minViablePrice) {
      survival = { level: 'warn', text: 'ต้องลดมาร์จิ้นลงต่ำกว่าเป้า 20% ถึงจะแข่งราคาได้ แต่ยังไม่ต่ำกว่าขั้นต่ำ 12%' }
    } else {
      survival = { level: 'danger', text: 'แข่งราคากับคู่แข่งไม่ได้เลยแม้ใช้มาร์จิ้นขั้นต่ำ 12% — ควรพิจารณา cutoff SKU นี้' }
    }
  }

  async function handleSave() {
    if (!skuId) {
      setMsg({ type: 'err', text: 'กรุณาเลือกสินค้าก่อน' })
      return
    }
    setSaving(true)
    setMsg(null)
    const { error } = await supabase.from('skus').update({
      ads_pct: ads,
      affiliate_pct: aff,
      affiliate_attach: attach,
      target_margin: target,
      min_margin: minM,
      competitor_price: comp,
      competitor_checked: new Date().toISOString().slice(0, 10),
      current_price: toNum(currentPrice, null) || null,
    }).eq('id', skuId)

    if (error) setMsg({ type: 'err', text: error.message })
    else setMsg({ type: 'ok', text: 'บันทึกค่าที่ตั้งไว้ลง SKU นี้แล้ว' })
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-4 flex items-center gap-3 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
        <button onClick={onBack} className="text-slate-400 hover:text-teal-400 transition text-sm">
          ← กลับ
        </button>
        <h1 className="text-lg font-bold">เครื่องคำนวณราคาขาย</h1>
      </header>

      <main className="p-4 space-y-4 max-w-md mx-auto">
        {loading ? (
          <p className="text-slate-500 text-sm">กำลังโหลด...</p>
        ) : (
          <>
            <Select
              label="เลือก SKU (หรือกรอกเองด้านล่างสำหรับสินค้าใหม่)"
              value={skuId}
              onChange={loadSku}
              placeholder="ไม่เลือก / กรอกเอง"
              options={skus.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
            />

            {stockInfo && (
              <div className={`rounded-xl p-4 border space-y-1 ${
                stockInfo.days_cover == null || stockInfo.days_cover > 90
                  ? 'bg-red-500/10 border-red-500/30'
                  : stockInfo.days_cover > 30
                  ? 'bg-yellow-500/10 border-yellow-500/30'
                  : 'bg-teal-500/10 border-teal-500/30'
              }`}>
                <h3 className="text-sm font-semibold text-slate-200">อัตราการหมุนสต๊อกของ SKU นี้</h3>
                <p className="text-xs text-slate-400">
                  คงเหลือ {stockInfo.on_hand} ชิ้น · ขายเฉลี่ย {stockInfo.per_day} ชิ้น/วัน
                </p>
                <p className="text-sm">
                  {stockInfo.days_cover == null
                    ? 'ไม่มีการขายออกใน 90 วันที่ผ่านมา — เป็น dead stock'
                    : `สต๊อกจะอยู่ได้อีกประมาณ ${stockInfo.days_cover} วัน ในอัตราขายปัจจุบัน`}
                </p>
                <p className="text-sm font-medium">
                  เงินจมอยู่ในสต๊อกตัวนี้: ฿{Number(stockInfo.capital_value).toLocaleString('th-TH')}
                </p>
                {(stockInfo.days_cover == null || stockInfo.days_cover > 90) && (
                  <p className="text-xs text-red-400 mt-1">
                    ⚠ หมุนช้ามาก — พิจารณาลดราคาระบายสต๊อก หรือ cutoff SKU นี้แทนการตั้งราคาปกติ
                  </p>
                )}
              </div>
            )}

            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">ต้นทุนและค่าธรรมเนียม</h3>

              <Input
                label="ต้นทุนหน้าคลังต่อชิ้น (บาท)"
                type="number"
                step="0.01"
                value={landedCost}
                onChange={(e) => setLandedCost(e.target.value)}
              />
              <Input
                label="ค่าธรรมเนียม Shopee/Lazada (%)"
                type="number"
                step="0.5"
                value={feePct}
                onChange={(e) => setFeePct(e.target.value)}
              />
              <Input
                label="ค่า Ads (% ของราคาขาย)"
                type="number"
                step="0.5"
                value={adsPct}
                onChange={(e) => setAdsPct(e.target.value)}
              />
              <Input
                label="ค่า Affiliate (% ถ้าเปิดใช้)"
                type="number"
                step="0.5"
                value={affiliatePct}
                onChange={(e) => setAffiliatePct(e.target.value)}
              />
              <Input
                label="สัดส่วนออเดอร์ที่มาจาก Affiliate (%)"
                type="number"
                step="5"
                value={affiliateAttach}
                onChange={(e) => setAffiliateAttach(e.target.value)}
              />
              <Input
                label="กำไรเป้าหมาย (%)"
                type="number"
                step="1"
                value={targetMargin}
                onChange={(e) => setTargetMargin(e.target.value)}
              />
              <Input
                label="กำไรขั้นต่ำที่รับได้ (%)"
                type="number"
                step="1"
                value={minMargin}
                onChange={(e) => setMinMargin(e.target.value)}
              />
            </div>

            {/* ผลลัพธ์ */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <p className="text-xs text-slate-400">ต้นทุน/ชิ้น</p>
                <p className="text-xl font-bold mt-1">฿{cost.toLocaleString('th-TH')}</p>
              </div>
              <div className="bg-teal-500/10 rounded-xl p-4 border border-teal-500/30">
                <p className="text-xs text-teal-400">ราคาขายที่ควรตั้ง</p>
                <p className="text-xl font-bold text-teal-400 mt-1">
                  {suggestedPrice ? `฿${suggestedPrice.toLocaleString('th-TH', { maximumFractionDigits: 0 })}` : '—'}
                </p>
              </div>
            </div>

            {/* ราคาปัจจุบัน + กำไรจริง */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">เช็คราคาที่ตั้งอยู่จริง</h3>
              <Input
                label="ราคาขายปัจจุบัน (บาท)"
                type="number"
                step="1"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                placeholder="เช่น 2199"
              />
              {currentMargins && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-slate-500">ออเดอร์ปกติ</p>
                    <p className={`text-sm font-semibold ${currentMargins.normalPct >= toNum(targetMargin) ? 'text-teal-400' : currentMargins.normalPct >= toNum(minMargin) ? 'text-yellow-400' : 'text-red-400'}`}>
                      {currentMargins.normalPct.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">ออเดอร์ affiliate</p>
                    <p className={`text-sm font-semibold ${currentMargins.affPct >= toNum(targetMargin) ? 'text-teal-400' : currentMargins.affPct >= toNum(minMargin) ? 'text-yellow-400' : 'text-red-400'}`}>
                      {currentMargins.affPct.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">เฉลี่ยถ่วงน้ำหนัก</p>
                    <p className={`text-sm font-semibold ${currentMargins.blendedPct >= toNum(targetMargin) ? 'text-teal-400' : currentMargins.blendedPct >= toNum(minMargin) ? 'text-yellow-400' : 'text-red-400'}`}>
                      {currentMargins.blendedPct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* เช็คความอยู่รอด */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">เช็คว่า SKU นี้ควรไปต่อไหม</h3>
              <Input
                label="ราคาคู่แข่ง (บาท)"
                type="number"
                step="1"
                value={competitorPrice}
                onChange={(e) => setCompetitorPrice(e.target.value)}
                placeholder="เช่น 1990"
              />
              {minViablePrice && (
                <p className="text-xs text-slate-500">
                  ราคาต่ำสุดที่ยังได้กำไรขั้นต่ำ {minMargin}%: <span className="text-slate-300 font-medium">฿{minViablePrice.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</span>
                </p>
              )}
              {survival && (
                <div className={`rounded-lg p-3 text-sm border ${
                  survival.level === 'ok' ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' :
                  survival.level === 'warn' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                  'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  {survival.text}
                </div>
              )}
            </div>

            {msg && (
              <p className={`text-sm ${msg.type === 'ok' ? 'text-teal-400' : 'text-red-400'}`}>{msg.text}</p>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !skuId}
              className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition disabled:opacity-50"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึกค่านี้ลง SKU'}
            </button>
          </>
        )}
      </main>
    </div>
  )
}
