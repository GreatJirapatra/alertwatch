// อ่านวันที่จากเลขออเดอร์ Shopee: 14 ตัวอักษร 6 ตัวแรกคือ yymmdd เช่น 260930DK0T9PA1 = 30 ก.ย. 2026
// ต้องตรงกับฟังก์ชัน order_date() ในฐานข้อมูล
const SHOPEE_RE = /^(\d{2})(\d{2})(\d{2})[0-9A-Za-z]{8}$/

export function orderDateFromNo(orderNo) {
  const s = String(orderNo || '').trim()
  const m = SHOPEE_RE.exec(s)
  if (!m) return null
  const y = 2000 + Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (y < 2024 || y > 2030 || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  // กันวันที่ไม่มีจริง เช่น 31 ก.ย.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// เลขที่ "หน้าตาเหมือน Shopee" (ขึ้นต้น 25–27 + เดือน/วัน) แต่ไม่ครบรูปแบบ -> น่าจะพิมพ์ผิด/พิมพ์ไม่ครบ
export function looksLikeBrokenShopeeNo(orderNo) {
  const s = String(orderNo || '').trim()
  if (!s || orderDateFromNo(s)) return false
  if (/^\d{15,}$/.test(s)) return false // เลข Lazada (ตัวเลขล้วน)
  // ตัวอักษร/ตัวเลขยาว 12–16 ตัว ที่ไม่ตรงรูปแบบ Shopee 14 ตัว
  return /^[0-9A-Za-z]{12,16}$/.test(s)
}
