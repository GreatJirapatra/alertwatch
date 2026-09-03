// จับคู่ 77 จังหวัด เข้ากับ 6 ภาคของประเทศไทย (ตามเกณฑ์ราชบัณฑิตยสถาน)
export const REGIONS = [
  { key: 'north', label: 'เหนือ', color: '#22d3ee' },
  { key: 'northeast', label: 'อีสาน', color: '#a78bfa' },
  { key: 'central', label: 'กลาง', color: '#2dd4bf' },
  { key: 'east', label: 'ตะวันออก', color: '#fb923c' },
  { key: 'west', label: 'ตะวันตก', color: '#facc15' },
  { key: 'south', label: 'ใต้', color: '#f472b6' },
]

export const PROVINCE_TO_REGION = {
  // เหนือ
  'เชียงใหม่': 'north', 'เชียงราย': 'north', 'น่าน': 'north', 'พะเยา': 'north',
  'แพร่': 'north', 'แม่ฮ่องสอน': 'north', 'ลำปาง': 'north', 'ลำพูน': 'north', 'อุตรดิตถ์': 'north',
  // อีสาน
  'กาฬสินธุ์': 'northeast', 'ขอนแก่น': 'northeast', 'ชัยภูมิ': 'northeast', 'นครพนม': 'northeast',
  'นครราชสีมา': 'northeast', 'บึงกาฬ': 'northeast', 'บุรีรัมย์': 'northeast', 'มหาสารคาม': 'northeast',
  'มุกดาหาร': 'northeast', 'ยโสธร': 'northeast', 'ร้อยเอ็ด': 'northeast', 'เลย': 'northeast',
  'ศรีสะเกษ': 'northeast', 'สกลนคร': 'northeast', 'สุรินทร์': 'northeast', 'หนองคาย': 'northeast',
  'หนองบัวลำภู': 'northeast', 'อำนาจเจริญ': 'northeast', 'อุดรธานี': 'northeast', 'อุบลราชธานี': 'northeast',
  // กลาง
  'กรุงเทพมหานคร': 'central', 'กำแพงเพชร': 'central', 'ชัยนาท': 'central', 'นครนายก': 'central',
  'นครปฐม': 'central', 'นครสวรรค์': 'central', 'นนทบุรี': 'central', 'ปทุมธานี': 'central',
  'พระนครศรีอยุธยา': 'central', 'พิจิตร': 'central', 'พิษณุโลก': 'central', 'เพชรบูรณ์': 'central',
  'ลพบุรี': 'central', 'สมุทรปราการ': 'central', 'สมุทรสงคราม': 'central', 'สมุทรสาคร': 'central',
  'สิงห์บุรี': 'central', 'สุโขทัย': 'central', 'สุพรรณบุรี': 'central', 'สระบุรี': 'central',
  'อ่างทอง': 'central', 'อุทัยธานี': 'central',
  // ตะวันออก
  'จันทบุรี': 'east', 'ฉะเชิงเทรา': 'east', 'ชลบุรี': 'east', 'ตราด': 'east',
  'ปราจีนบุรี': 'east', 'ระยอง': 'east', 'สระแก้ว': 'east',
  // ตะวันตก
  'กาญจนบุรี': 'west', 'ตาก': 'west', 'ประจวบคีรีขันธ์': 'west', 'เพชรบุรี': 'west', 'ราชบุรี': 'west',
  // ใต้
  'กระบี่': 'south', 'ชุมพร': 'south', 'ตรัง': 'south', 'นครศรีธรรมราช': 'south', 'นราธิวาส': 'south',
  'ปัตตานี': 'south', 'พังงา': 'south', 'พัทลุง': 'south', 'ภูเก็ต': 'south', 'ยะลา': 'south',
  'ระนอง': 'south', 'สงขลา': 'south', 'สตูล': 'south', 'สุราษฎร์ธานี': 'south',
}

// ฤดูกาลของไทย 3 ฤดู ตามเดือน (1-12)
export const SEASONS = [
  { key: 'summer', label: 'ร้อน (มี.ค.-พ.ค.)', months: [3, 4, 5], color: '#fb923c' },
  { key: 'rainy', label: 'ฝน (มิ.ย.-ต.ค.)', months: [6, 7, 8, 9, 10], color: '#38bdf8' },
  { key: 'winter', label: 'หนาว (พ.ย.-ก.พ.)', months: [11, 12, 1, 2], color: '#a78bfa' },
]

const MONTH_TO_SEASON = {}
SEASONS.forEach((s) => s.months.forEach((m) => { MONTH_TO_SEASON[m] = s.key }))
export { MONTH_TO_SEASON }
