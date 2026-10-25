import { SearchableSelect } from './SearchableSelect'

// ตัวเลือก SKU แบบค้นหาได้ — พฤติกรรมเหมือน <select> เดิม (onChange ส่งค่าเป็น string เสมอ)
// เพื่อให้หน้าที่ใช้ของเดิมไม่ต้องแก้ตรรกะ
export function SkuSelect({ onChange, ...props }) {
  return (
    <SearchableSelect
      {...props}
      onChange={(v) => onChange(v === '' || v == null ? '' : String(v))}
    />
  )
}
