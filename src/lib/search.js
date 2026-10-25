// ค้นหาแบบยืดหยุ่น ใช้กับรายการ SKU: ไม่สนตัวพิมพ์เล็ก-ใหญ่ ขีดกลาง ช่องว่าง
// "seal80" หา SEAL-80KPA เจอ, "oven pizza" หาเจอทุกรายการที่มีทั้งสองคำ, "s80" หาเจอแบบตัวย่อ
const SEPARATORS = /[\s\-_./()–—]+/g

export function normalizeText(s) {
  return String(s ?? '').toLowerCase().replace(SEPARATORS, '')
}

function isSubsequence(needle, hay) {
  let i = 0
  for (let k = 0; k < hay.length && i < needle.length; k++) {
    if (hay[k] === needle[i]) i++
  }
  return i === needle.length
}

// คืน null ถ้าไม่ตรง, ตัวเลขยิ่งน้อยยิ่งตรงมาก (0 = ไม่มีคำค้น)
export function matchScore(text, query) {
  const q = String(query ?? '').trim()
  if (!q) return 0
  const hay = normalizeText(text)
  const tokens = q.toLowerCase().split(/\s+/).map(normalizeText).filter(Boolean)
  if (tokens.length === 0) return 0
  let score = 0
  for (const t of tokens) {
    const idx = hay.indexOf(t)
    if (idx === 0) score += 0
    else if (idx > 0) score += 1 + idx / 1000
    else if (t.length >= 3 && isSubsequence(t, hay)) score += 5
    else return null
  }
  return score
}

export function matchesQuery(text, query) {
  return matchScore(text, query) !== null
}

// กรองและเรียงตามความตรง (คำค้นว่างคืนลำดับเดิม)
export function searchOptions(options, query, getText = (o) => o.label) {
  if (!String(query ?? '').trim()) return options
  return options
    .map((o, i) => ({ o, i, s: matchScore(getText(o), query) }))
    .filter((x) => x.s !== null)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.o)
}
