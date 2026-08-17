// แปลง array of objects เป็น CSV string และสั่งดาวน์โหลด
// ใส่ BOM (\uFEFF) นำหน้า เพื่อให้ Excel เปิดภาษาไทย/UTF-8 ได้ถูกต้อง ไม่เป็นตัวอักษรมั่ว
export function exportToCsv(filename, rows) {
  if (!rows || rows.length === 0) {
    alert('ไม่มีข้อมูลให้ export')
    return
  }

  const headers = Object.keys(rows[0])
  const escape = (val) => {
    if (val === null || val === undefined) return ''
    const s = String(val)
    // ครอบด้วย "" ถ้ามี comma, quote, หรือขึ้นบรรทัดใหม่
    if (/[",\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ]

  const csvContent = '\uFEFF' + lines.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function todayStamp() {
  return new Date().toISOString().slice(0, 10)
}
