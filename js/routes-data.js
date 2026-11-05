/**
 * ข้อมูลเส้นทางรถไฟไทย (Thai Railway Routes)
 * โครงสร้างข้อมูลแยกส่วน รองรับการเพิ่มสายใหม่ได้ง่าย
 */
const RAILWAY_ROUTES = [
  {
    id: 'northern',
    name: 'ทางรถไฟสายเหนือ (Northern Line)',
    shortName: 'สายเหนือ',
    code: 'NORTH',
    color: '#1b365d', // SRT Classic Navy Blue
    accentColor: '#c82333',
    totalKm: 751,
    origin: 'กรุงเทพ',
    destination: 'เชียงใหม่',
    description: 'เส้นทางประวัติศาสตร์จากที่ราบลุ่มภาคกลาง ลัดเลาะขุนเขาและอุโมงค์ขุนตานสู่นครพิงค์เชียงใหม่',
    stations: [
      {
        id: 'bkk',
        name: 'กรุงเทพ',
        nameEn: 'Bangkok',
        km: 0,
        province: 'กรุงเทพมหานคร',
        tagline: 'สถานีต้นทางประวัติศาสตร์หัวลำโพง',
        icon: '🏛️'
      },
      {
        id: 'aya',
        name: 'อยุธยา',
        nameEn: 'Ayutthaya',
        km: 76,
        province: 'พระนครศรีอยุธยา',
        tagline: 'ราชธานีเก่า มรดกโลกเจดีย์วัดใหญ่ชัยมงคล',
        icon: '🛕'
      },
      {
        id: 'lpb',
        name: 'ลพบุรี',
        nameEn: 'Lopburi',
        km: 133,
        province: 'ลพบุรี',
        tagline: 'เมืองละโว้ พระปรางค์สามยอดและลิงศาลพระกาฬ',
        icon: '🐒'
      },
      {
        id: 'nsw',
        name: 'นครสวรรค์',
        nameEn: 'Nakhon Sawan',
        km: 245,
        province: 'นครสวรรค์',
        tagline: 'ปากน้ำโพ จุดกำเนิดแม่น้ำเจ้าพระยา เมืองมังกร',
        icon: '🐉'
      },
      {
        id: 'psl',
        name: 'พิษณุโลก',
        nameEn: 'Phitsanulok',
        km: 377,
        province: 'พิษณุโลก',
        tagline: 'เมืองสองแคว นมัสการพระพุทธชินราช',
        icon: '⛩️'
      },
      {
        id: 'lpg',
        name: 'ลำปาง',
        nameEn: 'Lampang',
        km: 604,
        province: 'ลำปาง',
        tagline: 'เมืองเขลางค์นคร รถม้าลำปางและชามตราไก่',
        icon: '🐎'
      },
      {
        id: 'cnx',
        name: 'เชียงใหม่',
        nameEn: 'Chiang Mai',
        km: 751,
        province: 'เชียงใหม่',
        tagline: 'สถานีปลายทางสายเหนือ นครพิงค์ ดอยสุเทพงดงาม',
        icon: '⛰️'
      }
    ]
  },
  {
    id: 'northeastern',
    name: 'ทางรถไฟสายอีสาน (Northeastern Line)',
    shortName: 'สายอีสาน',
    code: 'NEAST',
    color: '#8b4513',
    accentColor: '#d2691e',
    totalKm: 624,
    origin: 'กรุงเทพ',
    destination: 'หนองคาย',
    description: 'เส้นทางสู่ดินแดนที่ราบสูง เลียบริมอ่างเก็บน้ำเขื่อนป่าสักชลสิทธิ์สู่แม่น้ำโขง',
    stations: [
      { id: 'bkk_ne', name: 'กรุงเทพ', nameEn: 'Bangkok', km: 0, province: 'กรุงเทพมหานคร', tagline: 'ต้นทางสถานีกลาง', icon: '🏛️' },
      { id: 'srb', name: 'สระบุรี', nameEn: 'Saraburi', km: 113, province: 'สระบุรี', tagline: 'ประตูสู่อีสาน รอยพระพุทธบาท', icon: '🛕' },
      { id: 'nak', name: 'นครราชสีมา', nameEn: 'Nakhon Ratchasima', km: 264, province: 'นครราชสีมา', tagline: 'เมืองย่าโม ประตูเมืองโคราช', icon: '⚔️' },
      { id: 'kkn', name: 'ขอนแก่น', nameEn: 'Khon Kaen', km: 450, province: 'ขอนแก่น', tagline: 'ศูนย์กลางอีสาน มหานครเสียงแคน', icon: '🦕' },
      { id: 'udn', name: 'อุดรธานี', nameEn: 'Udon Thani', km: 569, province: 'Udon Thani', tagline: 'ดินแดนทะเลบัวแดง อารยธรรมบ้านเชียง', icon: '🏺' },
      { id: 'nki', name: 'หนองคาย', nameEn: 'Nong Khai', km: 624, province: 'Nong Khai', tagline: 'ริมฝั่งโขง สะพานมิตรภาพไทย-ลาว', icon: '🌊' }
    ]
  },
  {
    id: 'southern',
    name: 'ทางรถไฟสายใต้ (Southern Line)',
    shortName: 'สายใต้',
    code: 'SOUTH',
    color: '#0d5c3a',
    accentColor: '#198754',
    totalKm: 945,
    origin: 'กรุงเทพ',
    destination: 'หาดใหญ่',
    description: 'เส้นทางเลาะชายฝั่งทะเลอ่าวไทย ข้ามแหลมมลายูสู่ชุมทางหาดใหญ่',
    stations: [
      { id: 'bkk_s', name: 'กรุงเทพ', nameEn: 'Bangkok', km: 0, province: 'กรุงเทพมหานคร', tagline: 'ต้นทางกรุงเทพมหานคร', icon: '🏛️' },
      { id: 'hhn', name: 'หัวหิน', nameEn: 'Hua Hin', km: 229, province: 'ประจวบคีรีขันธ์', tagline: 'พลับพลาพระมงกุฎเกล้าฯ เมืองพักตากอากาศ', icon: '🏖️' },
      { id: 'cpm', name: 'ชุมพร', nameEn: 'Chumphon', km: 485, province: 'ชุมพร', tagline: 'ประตูสู่ปักษ์ใต้ หาดทรายรี เสด็จเตี่ย', icon: '⚓' },
      { id: 'srt', name: 'สุราษฎร์ธานี', nameEn: 'Surat Thani', km: 651, province: 'สุราษฎร์ธานี', tagline: 'เมืองร้อยเกาะ เงาะอร่อย หอยใหญ่', icon: '🥥' },
      { id: 'hya', name: 'ชุมทางหาดใหญ่', nameEn: 'Hat Yai Junction', km: 945, province: 'สงขลา', tagline: 'ศูนย์กลางการค้าและคมนาคมแดนใต้', icon: '🏙️' }
    ]
  }
];

// อัตราการแปลงเวลาเป็นระยะทาง: 60 นาที = 30 กม. (1 นาที = 0.5 กม.)
const KM_PER_MINUTE = 0.5;

// ประเภทตั๋ว (Ticket Classes)
const TICKET_CLASSES = [
  { id: 'class3', name: 'ชั้น 3 (ธรรมดา)', badge: 'ชั้น 3', desc: 'มุ่งมั่นตั้งใจ อ่านยาวต่อเนื่องไม่มีพัก', icon: '🪑' },
  { id: 'class2', name: 'ชั้น 2 (ปรับอากาศ)', badge: 'ชั้น 2', desc: 'นั่งสบาย เย็นกาย สบายใจ พร้อมสมาธิ', icon: '❄️' },
  { id: 'class1', name: 'ชั้น 1 (ตู้นอน Pomodoro)', badge: 'ชั้น 1', desc: 'ชั้นพิเศษ บรรยากาศเงียบสงบสไตล์ตู้นอน', icon: '🛏️' }
];

// รายการชื่อขบวนรถไฟไทยสำหรับสร้างบรรยากาศสมจริง
const TRAIN_NAMES = [
  { no: '9', type: 'ด่วนพิเศษ "อุตราวิถี" (CNR)' },
  { no: '13', type: 'ด่วนพิเศษ กรุงเทพ - เชียงใหม่' },
  { no: '109', type: 'ขบวนเร็ว ดีเซลราง' },
  { no: '1', type: 'ด่วนพิเศษดีเซลราง สปินเตอร์' },
  { no: '51', type: 'ขบวนด่วน ปรับอากาศ' },
  { no: '7', type: 'ด่วนพิเศษ ดีเซลรางแดวู' }
];

// ข้อความประกาศในสถานี
const STATION_ANNOUNCEMENTS = [
  'ท่านผู้โดยสารโปรดทราบ ขบวนรถไฟเพื่อการเรียนรู้กำลังจะออกจากชานชาลา ขอให้ทุกท่านเตรียมสมาธิให้พร้อม',
  'กรุณานั่งประจำที่ ปิดเสียงรบกวนภายนอก และเปิดรับความรู้ตลอดการเดินทาง',
  'ขอต้อนรับสู่ขบวนรถอ่านหนังสือ ขอให้การเดินทางสู่เป้าหมายของท่านราบรื่นและประสบความสำเร็จ',
  'การเดินทางด้วยรถไฟสายความรู้กำลังจะเริ่มขึ้น ขอให้ผู้โดยสารมีความสุขกับการอ่าน'
];
