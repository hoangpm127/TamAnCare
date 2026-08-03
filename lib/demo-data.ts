import { addDays, addHours, format, setHours, setMinutes } from "date-fns";
import { FACILITY_BRANCHES, facilityRoomsForBranch } from "./facility-config";

export type DemoService = {
  id: string;
  name: string;
  slug: string;
  category: "BODY" | "FOOT" | "NECK_SHOULDER" | "HEAD_SPA" | "THERAPY" | "COMBO" | "OFFICE";
  description: string;
  durationMin: number;
  basePrice: number;
  therapistFee: number;
  popular?: boolean;
};

export type DemoTherapist = {
  id: string;
  fullName: string;
  branchId: string;
  skills: string[];
  ratingAvg: number;
  servedCount: number;
  repeatCount: number;
  status: "ACTIVE" | "OFF" | "HIDDEN";
  serviceIds: string[];
  bio: string;
  experienceYears: number;
  certifications: string[];
  reviews: { reviewer: string; rating: number; comment: string; date: string }[];
};

export type DemoRoom = {
  id: string;
  branchId: string;
  name: string;
  type: "HEAD_SPA_BED" | "MASSAGE_BED" | "FOOT_CHAIR" | "NECK_CHAIR" | "PRIVATE_ROOM";
  status: "ACTIVE" | "MAINTENANCE" | "HIDDEN";
  suitableCategories: DemoService["category"][];
};

export type DemoBooking = {
  id: string;
  bookingCode: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  therapistId: string;
  roomId: string;
  startTime: Date;
  endTime: Date;
  status: "CONFIRMED" | "CHECKED_IN" | "IN_SERVICE" | "COMPLETED" | "CANCELLED";
  totalAmount: number;
  depositAmount?: number;
  source: string;
};

export const branch = {
  id: "branch-tam-an",
  name: "Tâm An Center",
  tagline: "Thả lỏng cơ thể - Đánh thức năng lượng",
  address: "Số 34 Khu phố An Sinh, O16-CT2 Khu đô thị mới Tây Hồ, phường Nghĩa Đô, TP. Hà Nội",
  phone: "0963 039 273",
  zalo: "0963 039 273",
  facebook: "facebook.com/tamancenter.official",
  openTime: "08:00",
  closeTime: "22:00",
  lastBookingTime: "21:00",
  bufferMinutes: 15,
  ratingAvg: 4.9,
  reviewCount: 512,
  priceNote: "Giá trên chưa bao gồm tip cho KTV",
  description: "Massage Body, cổ vai gáy, chân, lưng hông và các liệu trình chăm sóc chuyên sâu.",
};

export const branches = FACILITY_BRANCHES.map((item) => ({ ...item }));

export const corporateDemoProfile = {
  companyName: "CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ PHÁT TRIỂN CÔNG NGHỆ XGROUP",
  internationalName: "XGROUP TECHNOLOGY DEVELOPMENT & INVESTMENT JOINT STOCK COMPANY",
  shortName: "XGROUP TDI., JSC",
  taxCode: "0107958564",
  officeAddress: "Số 2, ngõ 84 Chùa Láng, Phường Láng, Thành phố Hà Nội, Việt Nam",
  representative: "Mai Việt Hoàng",
  representativeTitle: "Giám đốc",
  phone: "0987172462",
  email: "hoangpm127@gmail.com",
  registrationDate: "14/08/2017",
};

export const bankAccount = {
  configured: true,
  bankId: "TPB",
  bankName: "TPBank",
  accountNumber: "12346666888",
  accountHolder: "CTCP DAU TU VA PT CONG NGHE XGROUP",
};

export const chatAssistant = {
  enabledByDefault: true,
  storageKey: "tam-an-ai-chat-enabled",
  label: "Trợ lý trả lời tự động (Chat)",
  description: "Tự động phân loại khách hàng (hành động ngay / đang suy xét / mới quan tâm) và trả lời theo kịch bản chăm sóc khách hàng khi khách nhắn vào mục Chat.",
};

export const services: DemoService[] = [
  {
    id: "svc-foot-60",
    name: "Foot Massage 60 phút",
    slug: "foot-massage-60",
    category: "FOOT",
    description: "Thư giãn bàn chân, bắp chân và giảm mệt mỏi khi di chuyển nhiều.",
    durationMin: 60,
    basePrice: 250000,
    therapistFee: 0,
    popular: true,
  },
  {
    id: "svc-foot-90",
    name: "Foot Massage 90 phút",
    slug: "foot-massage-90",
    category: "FOOT",
    description: "Thời lượng đủ dài để thư giãn sâu đôi chân sau ngày dài.",
    durationMin: 90,
    basePrice: 350000,
    therapistFee: 0,
  },
  {
    id: "svc-foot-120",
    name: "Foot Massage 120 phút",
    slug: "foot-massage-120",
    category: "FOOT",
    description: "Gói chăm sóc chuyên sâu cho khách đi định kỳ.",
    durationMin: 120,
    basePrice: 450000,
    therapistFee: 0,
  },
  {
    id: "svc-body-60",
    name: "Body Massage 60 phút",
    slug: "body-massage-60",
    category: "BODY",
    description: "Liệu trình body thư giãn toàn thân với giá rõ ràng.",
    durationMin: 60,
    basePrice: 250000,
    therapistFee: 0,
    popular: true,
  },
  {
    id: "svc-body-90",
    name: "Body Massage 90 phút",
    slug: "body-massage-90",
    category: "BODY",
    description: "Thời lượng đủ dài cho khách cần hồi phục năng lượng sau ngày làm việc.",
    durationMin: 90,
    basePrice: 350000,
    therapistFee: 0,
    popular: true,
  },
  {
    id: "svc-body-120",
    name: "Body Massage 120 phút",
    slug: "body-massage-120",
    category: "BODY",
    description: "Gói chăm sóc chuyên sâu cho khách đi định kỳ.",
    durationMin: 120,
    basePrice: 450000,
    therapistFee: 0,
  },
  {
    id: "svc-cupping",
    name: "Giác hơi",
    slug: "giac-hoi",
    category: "THERAPY",
    description: "Giác hơi lưu thông khí huyết, giảm mỏi cơ và đào thải độc tố.",
    durationMin: 20,
    basePrice: 100000,
    therapistFee: 0,
  },
  {
    id: "svc-head-60",
    name: "Gội đầu dưỡng sinh",
    slug: "goi-dau-duong-sinh",
    category: "HEAD_SPA",
    description: "Gội đầu thư giãn, chăm sóc da đầu và vùng cổ vai.",
    durationMin: 60,
    basePrice: 250000,
    therapistFee: 0,
  },
  {
    id: "svc-neck-deep-60",
    name: "Vai gáy chuyên sâu - đắp thuốc 60 phút",
    slug: "vai-gay-chuyen-sau-60",
    category: "THERAPY",
    description: "Trị liệu chuyên sâu vùng vai gáy kết hợp đắp thuốc thảo dược.",
    durationMin: 60,
    basePrice: 350000,
    therapistFee: 0,
  },
  {
    id: "svc-body-deep-90",
    name: "Body chuyên sâu - đắp thuốc 90 phút",
    slug: "body-chuyen-sau-90",
    category: "THERAPY",
    description: "Trị liệu toàn thân chuyên sâu kết hợp đắp thuốc thảo dược.",
    durationMin: 90,
    basePrice: 500000,
    therapistFee: 0,
    popular: true,
  },
  {
    id: "svc-office-15",
    name: "Tâm An Business 15 phút",
    slug: "tam-an-lunch-reset-15",
    category: "OFFICE",
    description: "Phiên reset ngắn tại văn phòng để lấy data và phát voucher.",
    durationMin: 15,
    basePrice: 59000,
    therapistFee: 0,
  },
  {
    id: "svc-office-20",
    name: "Tâm An Business 20 phút",
    slug: "tam-an-lunch-reset-20",
    category: "OFFICE",
    description: "Phiên chăm sóc cổ vai gáy ngắn cho chương trình văn phòng.",
    durationMin: 20,
    basePrice: 89000,
    therapistFee: 0,
  },
];

const BASE_CERT = "Chứng chỉ KTV trị liệu cấp Bộ LĐTBXH";

export const therapists: DemoTherapist[] = [
  {
    id: "th-lan",
    fullName: "KTV Dung",
    branchId: "cs1",
    skills: ["Vai gáy chuyên sâu", "Body", "Khách văn phòng"],
    ratingAvg: 4.9,
    servedCount: 286,
    repeatCount: 92,
    status: "ACTIVE",
    serviceIds: ["svc-neck-deep-60", "svc-body-60", "svc-body-90", "svc-body-deep-90"],
    bio: "Hơn 6 năm kinh nghiệm trị liệu vai gáy cho dân văn phòng, tay nghề vững với lực vừa, tập trung giải toả căng cứng vùng cổ vai gáy và lưng trên.",
    experienceYears: 6,
    certifications: [BASE_CERT, "Chuyên sâu trị liệu vai gáy - đắp thuốc thảo dược"],
    reviews: [
      { reviewer: "Minh Anh", rating: 5, comment: "Chị Dung bấm rất đúng huyệt, đỡ mỏi vai gáy hẳn sau buổi đầu.", date: "05/07/2026" },
      { reviewer: "Thu Hà", rating: 5, comment: "Lực tay vừa phải, dễ chịu, sẽ quay lại.", date: "22/06/2026" },
    ],
  },
  {
    id: "th-huong",
    fullName: "KTV Hương",
    branchId: "cs1",
    skills: ["Foot", "Gội đầu", "Giác hơi"],
    ratingAvg: 4.8,
    servedCount: 241,
    repeatCount: 73,
    status: "ACTIVE",
    serviceIds: ["svc-foot-60", "svc-foot-90", "svc-foot-120", "svc-head-60", "svc-cupping"],
    bio: "Chuyên sâu Foot Massage và gội đầu dưỡng sinh, thao tác nhẹ nhàng, phù hợp khách cần thư giãn sâu sau ngày dài di chuyển.",
    experienceYears: 4,
    certifications: [BASE_CERT, "Đào tạo gội đầu dưỡng sinh chuẩn Nhật"],
    reviews: [
      { reviewer: "Hoàng Nam", rating: 5, comment: "Gội đầu dưỡng sinh rất thư giãn, chị Hương tận tình.", date: "01/07/2026" },
      { reviewer: "Ngọc Lan", rating: 4, comment: "Foot massage ổn, không gian sạch sẽ.", date: "18/06/2026" },
    ],
  },
  {
    id: "th-mai",
    fullName: "KTV Hồng",
    branchId: "cs1",
    skills: ["Body", "Lực mạnh", "Khách VIP"],
    ratingAvg: 4.9,
    servedCount: 312,
    repeatCount: 118,
    status: "ACTIVE",
    serviceIds: ["svc-body-60", "svc-body-90", "svc-body-120", "svc-body-deep-90"],
    bio: "KTV kỳ cựu nhất cơ sở, chuyên trị liệu Body lực mạnh cho khách quen và khách VIP, kiểm soát lực tay chính xác theo tình trạng cơ thể từng khách.",
    experienceYears: 8,
    certifications: [BASE_CERT, "Chứng chỉ Shiatsu Nhật Bản"],
    reviews: [
      { reviewer: "Thu Hà", rating: 5, comment: "KTV VIP đúng nghĩa, lực mạnh mà không đau, rất chuyên nghiệp.", date: "10/07/2026" },
      { reviewer: "Gia Bảo", rating: 5, comment: "Đặt lại lần 3 rồi, chị Hồng luôn hiểu đúng nhu cầu.", date: "25/06/2026" },
    ],
  },
  {
    id: "th-anh",
    fullName: "KTV Chi",
    branchId: "cs1",
    skills: ["Vai gáy", "Gội đầu", "Lực nhẹ"],
    ratingAvg: 4.7,
    servedCount: 198,
    repeatCount: 54,
    status: "ACTIVE",
    serviceIds: ["svc-neck-deep-60", "svc-head-60", "svc-office-15", "svc-office-20"],
    bio: "Phù hợp khách mới, khách lớn tuổi hoặc cần lực nhẹ nhàng, tận tâm hỏi kỹ tình trạng cơ thể trước mỗi buổi trị liệu.",
    experienceYears: 3,
    certifications: [BASE_CERT, "Đào tạo nội bộ Tâm An 200 giờ"],
    reviews: [
      { reviewer: "Việt Hoàng", rating: 5, comment: "Lực nhẹ nhàng phù hợp mẹ mình lớn tuổi.", date: "12/07/2026" },
      { reviewer: "Đức Anh", rating: 4, comment: "Chu đáo, hỏi kỹ tình trạng trước khi làm.", date: "03/07/2026" },
    ],
  },
  {
    id: "th-trang",
    fullName: "KTV Yến",
    branchId: "cs1",
    skills: ["Foot", "Body", "Lực vừa"],
    ratingAvg: 4.8,
    servedCount: 226,
    repeatCount: 66,
    status: "ACTIVE",
    serviceIds: ["svc-foot-60", "svc-foot-90", "svc-foot-120", "svc-body-60", "svc-body-90"],
    bio: "Linh hoạt cả Foot và Body, lực vừa dễ chịu, được nhiều khách nữ tin tưởng đặt lại thường xuyên.",
    experienceYears: 5,
    certifications: [BASE_CERT, "Đào tạo nội bộ Tâm An 200 giờ"],
    reviews: [
      { reviewer: "Lan Phương", rating: 5, comment: "Body và Foot đều tốt, lực vừa dễ chịu.", date: "14/07/2026" },
      { reviewer: "Thuỳ Trang", rating: 5, comment: "Nhiệt tình, không gian yên tĩnh.", date: "29/06/2026" },
    ],
  },
  {
    id: "th-ngoc",
    fullName: "KTV Thảo",
    branchId: "cs1",
    skills: ["Tâm An Business", "Vai gáy", "Giác hơi"],
    ratingAvg: 4.9,
    servedCount: 175,
    repeatCount: 61,
    status: "ACTIVE",
    serviceIds: ["svc-neck-deep-60", "svc-cupping", "svc-office-15", "svc-office-20"],
    bio: "Phụ trách chương trình Tâm An Business tại văn phòng, thao tác nhanh gọn trong 15-20 phút vẫn đảm bảo hiệu quả thư giãn rõ rệt.",
    experienceYears: 3,
    certifications: [BASE_CERT, "Đào tạo chương trình Tâm An Business văn phòng"],
    reviews: [
      { reviewer: "Minh Quân", rating: 5, comment: "Tâm An Business 20 phút mà vẫn thấy nhẹ hẳn cổ vai gáy.", date: "16/07/2026" },
      { reviewer: "Hải Yến", rating: 4, comment: "Nhanh gọn phù hợp giờ nghỉ trưa ở văn phòng.", date: "09/07/2026" },
    ],
  },
  {
    id: "th-duyen",
    fullName: "KTV Duyên",
    branchId: "cs1",
    skills: ["Body chuyên sâu", "Đắp thuốc thảo dược", "Lực mạnh"],
    ratingAvg: 4.8,
    servedCount: 205,
    repeatCount: 70,
    status: "ACTIVE",
    serviceIds: ["svc-body-deep-90", "svc-body-90", "svc-body-120", "svc-neck-deep-60"],
    bio: "Chuyên trị liệu Body chuyên sâu kết hợp đắp thuốc thảo dược, kiểm soát lực tay tốt cho khách đau mỏi lâu ngày.",
    experienceYears: 5,
    certifications: [BASE_CERT, "Chuyên sâu đắp thuốc thảo dược Đông y"],
    reviews: [
      { reviewer: "Phương Thảo", rating: 5, comment: "Chị Duyên đắp thuốc rất kỹ, đỡ đau lưng thấy rõ sau 2 buổi.", date: "11/07/2026" },
      { reviewer: "Quang Huy", rating: 5, comment: "Lực mạnh vừa đủ, không đau, thư giãn hẳn.", date: "30/06/2026" },
    ],
  },
  {
    id: "th-nam",
    fullName: "Nam (Quản lý)",
    branchId: "cs1",
    skills: ["Quản lý cơ sở", "Body", "Vai gáy"],
    ratingAvg: 4.9,
    servedCount: 0,
    repeatCount: 0,
    status: "HIDDEN",
    serviceIds: ["svc-body-90", "svc-neck-deep-60", "svc-body-deep-90"],
    bio: "Quản lý cơ sở Cầu Giấy, trực tiếp hỗ trợ trị liệu khi cần để đảm bảo chất lượng dịch vụ đồng đều. Không hiển thị công khai cho khách để đảm bảo công bằng với đội ngũ KTV.",
    experienceYears: 9,
    certifications: [BASE_CERT, "Đào tạo quản lý vận hành spa"],
    reviews: [],
  },
  {
    id: "th-linh",
    fullName: "KTV Linh",
    branchId: "cs2",
    skills: ["Foot", "Body", "Lực vừa"],
    ratingAvg: 4.8,
    servedCount: 164,
    repeatCount: 51,
    status: "ACTIVE",
    serviceIds: ["svc-foot-60", "svc-foot-90", "svc-foot-120", "svc-body-60", "svc-body-90"],
    bio: "Chuyên Foot và Body lực vừa, thao tác tỉ mỉ, được nhiều khách quen ở cơ sở 2 tin tưởng đặt lại.",
    experienceYears: 4,
    certifications: [BASE_CERT, "Đào tạo nội bộ Tâm An 200 giờ"],
    reviews: [
      { reviewer: "Bảo Trâm", rating: 5, comment: "Chị Linh làm kỹ, lực vừa đủ, rất thoải mái.", date: "08/07/2026" },
      { reviewer: "Anh Tuấn", rating: 5, comment: "Chuyên nghiệp, đúng giờ hẹn.", date: "20/06/2026" },
    ],
  },
  {
    id: "th-ha",
    fullName: "KTV Hà",
    branchId: "cs2",
    skills: ["Body", "Vai gáy chuyên sâu", "Lực mạnh"],
    ratingAvg: 4.9,
    servedCount: 201,
    repeatCount: 68,
    status: "ACTIVE",
    serviceIds: ["svc-body-60", "svc-body-90", "svc-body-120", "svc-neck-deep-60", "svc-body-deep-90"],
    bio: "Kinh nghiệm lâu năm trị liệu Body và vai gáy chuyên sâu, lực mạnh nhưng kiểm soát tốt theo thể trạng khách.",
    experienceYears: 7,
    certifications: [BASE_CERT, "Chuyên sâu trị liệu vai gáy - đắp thuốc thảo dược"],
    reviews: [
      { reviewer: "Minh Đức", rating: 5, comment: "Chị Hà bấm rất chuẩn, đỡ mỏi vai gáy hẳn.", date: "05/07/2026" },
      { reviewer: "Thuý Vy", rating: 4, comment: "Lực hơi mạnh nhưng dễ chịu sau buổi.", date: "22/06/2026" },
    ],
  },
  {
    id: "th-my",
    fullName: "KTV My",
    branchId: "cs2",
    skills: ["Gội đầu", "Giác hơi", "Lực nhẹ"],
    ratingAvg: 4.7,
    servedCount: 132,
    repeatCount: 39,
    status: "ACTIVE",
    serviceIds: ["svc-head-60", "svc-cupping", "svc-office-15", "svc-office-20"],
    bio: "Phù hợp khách mới hoặc cần lực nhẹ nhàng, chuyên gội đầu dưỡng sinh và giác hơi thư giãn.",
    experienceYears: 3,
    certifications: [BASE_CERT, "Đào tạo gội đầu dưỡng sinh chuẩn Nhật"],
    reviews: [
      { reviewer: "Ngọc Hân", rating: 5, comment: "Gội đầu rất thư giãn, chị My nhẹ nhàng chu đáo.", date: "14/07/2026" },
      { reviewer: "Hoàng Long", rating: 4, comment: "Giác hơi ổn, không gian sạch sẽ.", date: "01/07/2026" },
    ],
  },
  {
    id: "th-nga",
    fullName: "KTV Nga",
    branchId: "cs2",
    skills: ["Foot", "Vai gáy", "Lực vừa"],
    ratingAvg: 4.8,
    servedCount: 178,
    repeatCount: 55,
    status: "ACTIVE",
    serviceIds: ["svc-foot-60", "svc-foot-90", "svc-neck-deep-60"],
    bio: "Linh hoạt Foot và vai gáy, lực vừa dễ chịu, tận tâm hỏi kỹ tình trạng khách trước mỗi buổi.",
    experienceYears: 5,
    certifications: [BASE_CERT, "Đào tạo nội bộ Tâm An 200 giờ"],
    reviews: [
      { reviewer: "Diệu Linh", rating: 5, comment: "Foot massage rất đã, chị Nga tay nghề tốt.", date: "16/07/2026" },
      { reviewer: "Quốc Bảo", rating: 5, comment: "Vai gáy đỡ mỏi rõ rệt sau buổi.", date: "03/07/2026" },
    ],
  },
];

export const rooms: DemoRoom[] = FACILITY_BRANCHES.flatMap((facilityBranch) =>
  facilityRoomsForBranch(facilityBranch.id).map((room) => ({ ...room, status: "ACTIVE" as const })),
);

const today = new Date();
const at = (hour: number, minute = 0) => setMinutes(setHours(today, hour), minute);

// UTC-anchored helpers for date-only text that gets server-rendered: local `format(addDays(...))`
// resolves to a different calendar day depending on the executing environment's timezone (e.g. a
// dev machine in one timezone vs a phone in another), which causes a hydration text mismatch.
// Epoch-based math + UTC field extraction is identical everywhere regardless of local timezone.
function addDaysUtc(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
function formatUtcDDMMYYYY(date: Date) {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
}

export const bookings: DemoBooking[] = [
  {
    id: "bk-1",
    bookingCode: "TAC-DEMO-001",
    customerName: "Minh Anh",
    customerPhone: "0901234567",
    serviceId: "svc-body-60",
    therapistId: "th-lan",
    roomId: "cs1-seat-10",
    startTime: at(10),
    endTime: at(11),
    status: "COMPLETED",
    totalAmount: 250000,
    source: "Google Tâm An Center",
  },
  {
    id: "bk-4",
    bookingCode: "TAC-DEMO-004",
    customerName: "Minh Anh",
    customerPhone: "0901234567",
    serviceId: "svc-body-90",
    therapistId: "th-lan",
    roomId: "cs1-seat-10",
    startTime: addDays(at(15), 3),
    endTime: addDays(at(16, 30), 3),
    status: "CONFIRMED",
    totalAmount: 350000,
    depositAmount: 35000,
    source: "App khách hàng",
  },
  {
    id: "bk-5",
    bookingCode: "TAC-DEMO-005",
    customerName: "Minh Anh",
    customerPhone: "0901234567",
    serviceId: "svc-neck-deep-60",
    therapistId: "th-lan",
    roomId: "cs1-seat-11",
    startTime: addDays(at(9, 30), -20),
    endTime: addDays(at(10, 30), -20),
    status: "COMPLETED",
    totalAmount: 350000,
    source: "App khách hàng",
  },
  {
    id: "bk-2",
    bookingCode: "TAC-DEMO-002",
    customerName: "Hoang Nam",
    customerPhone: "0912345678",
    serviceId: "svc-neck-deep-60",
    therapistId: "th-ha",
    roomId: "cs1-seat-11",
    startTime: at(13, 30),
    endTime: at(14, 30),
    status: "CONFIRMED",
    totalAmount: 350000,
    source: "Facebook Tâm An Center",
  },
  {
    id: "bk-3",
    bookingCode: "TAC-DEMO-003",
    customerName: "Thu Ha",
    customerPhone: "0987654321",
    serviceId: "svc-body-deep-90",
    therapistId: "th-mai",
    roomId: "cs2-seat-10",
    startTime: at(17),
    endTime: at(18, 30),
    status: "CONFIRMED",
    totalAmount: 500000,
    source: "TikTok Vai Gáy Dân Văn Phòng",
  },
];

export const customers = [
  {
    id: "cus-1",
    fullName: "Minh Anh",
    phone: "0901234567",
    segment: "RETURNING",
    totalVisits: 4,
    totalSpend: 735000,
    favoriteTherapist: "KTV Lan",
    lastVisit: format(addDays(today, -7), "dd/MM/yyyy"),
    note: "Thích lực vừa, tập trung lưng trên.",
  },
  {
    id: "cus-2",
    fullName: "Hoang Nam",
    phone: "0912345678",
    segment: "NEW",
    totalVisits: 1,
    totalSpend: 300000,
    favoriteTherapist: "KTV Ngọc",
    lastVisit: format(today, "dd/MM/yyyy"),
    note: "Khách văn phòng khu Duy Tân.",
  },
  {
    id: "cus-3",
    fullName: "Thu Ha",
    phone: "0987654321",
    segment: "VIP",
    totalVisits: 12,
    totalSpend: 6200000,
    favoriteTherapist: "KTV Mai",
    lastVisit: format(addDays(today, -14), "dd/MM/yyyy"),
    note: "Thích đặt lại KTV cũ, ưu tiên phòng riêng.",
  },
];

export const currentCustomer = customers[0];

export type DemoNotification = {
  id: string;
  type: "BOOKING" | "PROMO" | "REMINDER" | "SYSTEM" | "BUSINESS" | "INVITE";
  title: string;
  body: string;
  createdAt: Date;
  read: boolean;
};

export const notifications: DemoNotification[] = [
  {
    id: "noti-invite-1",
    type: "INVITE",
    title: "Anh Quân mời bạn đi massage cùng",
    body: "Body Massage 90 phút tại Cơ sở 1 · hệ thống sẽ ưu tiên xếp 2 giường gần nhau để vừa thư giãn vừa trò chuyện.",
    createdAt: addHours(today, -1),
    read: false,
  },
  {
    id: "noti-1",
    type: "BOOKING",
    title: "Lịch của bạn đã được xác nhận",
    body: "Body Massage 90 phút với KTV Lan lúc 15:00, còn 3 ngày nữa.",
    createdAt: addHours(today, -2),
    read: false,
  },
  {
    id: "noti-2",
    type: "PROMO",
    title: "Ưu đãi RETURN7 dành riêng cho bạn",
    body: "Giảm 10% khi đặt lại trong vòng 7 ngày kể từ lần ghé gần nhất.",
    createdAt: addDays(today, -1),
    read: false,
  },
  {
    id: "noti-3",
    type: "REMINDER",
    title: "Đã lâu bạn chưa quay lại Tâm An",
    body: "Đặt lịch cổ vai gáy để giữ lịch chăm sóc đều đặn nhé.",
    createdAt: addDays(today, -3),
    read: true,
  },
  {
    id: "noti-4",
    type: "SYSTEM",
    title: "Cập nhật giờ mở cửa dịp lễ",
    body: "Tâm An Center mở cửa 08:00 - 22:00 hằng ngày.",
    createdAt: addDays(today, -6),
    read: true,
  },
];

export const referralTiers = [
  { name: "Đồng", threshold: 0, icon: "🥉" },
  { name: "Bạc", threshold: 100000, icon: "🥈" },
  { name: "Vàng", threshold: 300000, icon: "🥇" },
  { name: "Kim Cương", threshold: 600000, icon: "💎" },
  { name: "Bạch Kim", threshold: 1500000, icon: "🏆" },
  { name: "Huyền Thoại", threshold: 5000000, icon: "👑" },
];

export type ReferralOrderCategory = "INDIVIDUAL" | "GROUP" | "BUSINESS";

export type ReferralOrder = {
  id: string;
  serviceLabel: string;
  amount: number;
  commission: number;
  status: "SCHEDULED" | "COMPLETED";
  date: string;
  isoDate: string;
  category: ReferralOrderCategory;
};

export type ReferralFriend = {
  name: string;
  status: "COMPLETED" | "PENDING";
  reward: number;
  joinedAt: string;
  note: string;
  orders: ReferralOrder[];
};

export const referral = {
  code: "MINHANH4567",
  rewardForYou: "50.000đ khi bạn mình hoàn thành buổi đầu tiên",
  rewardForFriend: "Giảm ngay 50.000đ cho lần đặt lịch đầu tiên",
  totalEarned: 6450000,
  monthlyEarnings: [
    { month: "T2", amount: 700000 },
    { month: "T3", amount: 600000 },
    { month: "T4", amount: 1150000 },
    { month: "T5", amount: 950000 },
    { month: "T6", amount: 1400000 },
    { month: "T7", amount: 1650000 },
  ],
  invited: [
    {
      name: "Lan Phương",
      status: "COMPLETED" as const,
      reward: 50000,
      joinedAt: "12/06/2026",
      note: "Khách lẻ",
      orders: [
        {
          id: "ro-1",
          serviceLabel: "Foot Massage 60 phút",
          amount: 250000,
          commission: 50000,
          status: "COMPLETED" as const,
          date: "12/06/2026",
          isoDate: "2026-06-12",
          category: "INDIVIDUAL" as const,
        },
      ],
    },
    {
      name: "Thuỳ Trang",
      status: "COMPLETED" as const,
      reward: 50000,
      joinedAt: "28/06/2026",
      note: "Khách lẻ",
      orders: [
        {
          id: "ro-2",
          serviceLabel: "Body Massage 60 phút",
          amount: 250000,
          commission: 50000,
          status: "COMPLETED" as const,
          date: "28/06/2026",
          isoDate: "2026-06-28",
          category: "INDIVIDUAL" as const,
        },
      ],
    },
    {
      name: "Đức Anh",
      status: "COMPLETED" as const,
      reward: 50000,
      joinedAt: "10/07/2026",
      note: "Khách lẻ",
      orders: [
        {
          id: "ro-3",
          serviceLabel: "Foot Massage 60 phút",
          amount: 250000,
          commission: 50000,
          status: "COMPLETED" as const,
          date: "10/07/2026",
          isoDate: "2026-07-10",
          category: "INDIVIDUAL" as const,
        },
      ],
    },
    {
      name: "Minh Quân",
      status: "COMPLETED" as const,
      reward: 50000,
      joinedAt: "13/07/2026",
      note: "Khách lẻ",
      orders: [
        {
          id: "ro-4",
          serviceLabel: "Body Massage 60 phút",
          amount: 250000,
          commission: 50000,
          status: "COMPLETED" as const,
          date: "13/07/2026",
          isoDate: "2026-07-13",
          category: "INDIVIDUAL" as const,
        },
      ],
    },
    {
      name: "Gia Bảo",
      status: "COMPLETED" as const,
      reward: 50000,
      joinedAt: "15/07/2026",
      note: "Khách lẻ",
      orders: [
        {
          id: "ro-5",
          serviceLabel: "Foot Massage 90 phút",
          amount: 350000,
          commission: 50000,
          status: "COMPLETED" as const,
          date: "15/07/2026",
          isoDate: "2026-07-15",
          category: "INDIVIDUAL" as const,
        },
      ],
    },
    {
      name: "Hải Yến",
      status: "COMPLETED" as const,
      reward: 100000,
      joinedAt: "16/07/2026",
      note: "Giới thiệu gói dài hạn",
      orders: [
        {
          id: "ro-6",
          serviceLabel: "Gói dài hạn 29+5 (đợt 1)",
          amount: 500000,
          commission: 50000,
          status: "COMPLETED" as const,
          date: "16/07/2026",
          isoDate: "2026-07-16",
          category: "INDIVIDUAL" as const,
        },
        {
          id: "ro-7",
          serviceLabel: "Gói dài hạn 29+5 (đợt 2)",
          amount: 500000,
          commission: 50000,
          status: "COMPLETED" as const,
          date: "22/07/2026",
          isoDate: "2026-07-22",
          category: "INDIVIDUAL" as const,
        },
      ],
    },
    {
      name: "Ngọc Diệp",
      status: "COMPLETED" as const,
      reward: 100000,
      joinedAt: "17/07/2026",
      note: "Giới thiệu gói dài hạn",
      orders: [
        {
          id: "ro-8",
          serviceLabel: "Gói dài hạn 29+5",
          amount: 1000000,
          commission: 100000,
          status: "COMPLETED" as const,
          date: "17/07/2026",
          isoDate: "2026-07-17",
          category: "INDIVIDUAL" as const,
        },
      ],
    },
    {
      name: "Văn phòng ABC (Affiliate)",
      status: "COMPLETED" as const,
      reward: 300000,
      joinedAt: "14/07/2026",
      note: "Chương trình Tâm An Business văn phòng",
      orders: [
        {
          id: "ro-9",
          serviceLabel: "Tâm An Business - buổi 1 (12 người)",
          amount: 900000,
          commission: 100000,
          status: "COMPLETED" as const,
          date: "14/07/2026",
          isoDate: "2026-07-14",
          category: "BUSINESS" as const,
        },
        {
          id: "ro-10",
          serviceLabel: "Tâm An Business - buổi 2 (10 người)",
          amount: 750000,
          commission: 100000,
          status: "COMPLETED" as const,
          date: "21/07/2026",
          isoDate: "2026-07-21",
          category: "BUSINESS" as const,
        },
        {
          id: "ro-11",
          serviceLabel: "Tâm An Business - buổi 3 (11 người)",
          amount: 825000,
          commission: 100000,
          status: "COMPLETED" as const,
          date: "28/07/2026",
          isoDate: "2026-07-28",
          category: "BUSINESS" as const,
        },
      ],
    },
    {
      name: "CLB Yoga Sức Khỏe",
      status: "COMPLETED" as const,
      reward: 700000,
      joinedAt: "18/02/2026",
      note: "Giới thiệu nhóm tập thể",
      orders: [
        {
          id: "ro-13",
          serviceLabel: "Buổi thư giãn nhóm Yoga (10 người)",
          amount: 2500000,
          commission: 700000,
          status: "COMPLETED" as const,
          date: "20/02/2026",
          isoDate: "2026-02-20",
          category: "GROUP" as const,
        },
      ],
    },
    {
      name: "Gia đình chị Lan",
      status: "COMPLETED" as const,
      reward: 350000,
      joinedAt: "06/03/2026",
      note: "Khách gia đình",
      orders: [
        {
          id: "ro-14",
          serviceLabel: "Massage gia đình cuối tuần (6 người)",
          amount: 1500000,
          commission: 350000,
          status: "COMPLETED" as const,
          date: "08/03/2026",
          isoDate: "2026-03-08",
          category: "GROUP" as const,
        },
      ],
    },
    {
      name: "Nhóm chị em Spa Day",
      status: "COMPLETED" as const,
      reward: 500000,
      joinedAt: "20/03/2026",
      note: "Khách nhóm bạn bè",
      orders: [
        {
          id: "ro-15",
          serviceLabel: "Spa Day buổi 1 (8 người)",
          amount: 2000000,
          commission: 250000,
          status: "COMPLETED" as const,
          date: "22/03/2026",
          isoDate: "2026-03-22",
          category: "GROUP" as const,
        },
        {
          id: "ro-16",
          serviceLabel: "Spa Day buổi 2 (8 người)",
          amount: 2000000,
          commission: 250000,
          status: "COMPLETED" as const,
          date: "19/04/2026",
          isoDate: "2026-04-19",
          category: "GROUP" as const,
        },
      ],
    },
    {
      name: "Đoàn công tác Đà Nẵng",
      status: "COMPLETED" as const,
      reward: 900000,
      joinedAt: "23/04/2026",
      note: "Khách đoàn công tác",
      orders: [
        {
          id: "ro-17",
          serviceLabel: "Massage sau chuyến công tác (15 người)",
          amount: 3750000,
          commission: 900000,
          status: "COMPLETED" as const,
          date: "25/04/2026",
          isoDate: "2026-04-25",
          category: "GROUP" as const,
        },
        {
          id: "ro-18",
          serviceLabel: "Đoàn công tác tiếp theo (dự kiến 12 người)",
          amount: 3000000,
          commission: 700000,
          status: "SCHEDULED" as const,
          date: "15/08/2026",
          isoDate: "2026-08-15",
          category: "GROUP" as const,
        },
      ],
    },
    {
      name: "Công ty TNHH Đại Phát",
      status: "COMPLETED" as const,
      reward: 650000,
      joinedAt: "10/05/2026",
      note: "Phúc lợi chăm sóc nhân sự",
      orders: [
        {
          id: "ro-19",
          serviceLabel: "Chăm sóc nhân sự quý II (18 người)",
          amount: 2700000,
          commission: 650000,
          status: "COMPLETED" as const,
          date: "12/05/2026",
          isoDate: "2026-05-12",
          category: "BUSINESS" as const,
        },
      ],
    },
    {
      name: "Trường Mầm non Hoa Sen",
      status: "COMPLETED" as const,
      reward: 600000,
      joinedAt: "24/05/2026",
      note: "Chương trình Tâm An Business cho giáo viên",
      orders: [
        {
          id: "ro-20",
          serviceLabel: "Chăm sóc giáo viên - đợt 1 (14 người)",
          amount: 1400000,
          commission: 300000,
          status: "COMPLETED" as const,
          date: "26/05/2026",
          isoDate: "2026-05-26",
          category: "BUSINESS" as const,
        },
        {
          id: "ro-21",
          serviceLabel: "Chăm sóc giáo viên - đợt 2 (14 người)",
          amount: 1400000,
          commission: 300000,
          status: "COMPLETED" as const,
          date: "09/06/2026",
          isoDate: "2026-06-09",
          category: "BUSINESS" as const,
        },
      ],
    },
    {
      name: "Tập đoàn Xây dựng HHC",
      status: "COMPLETED" as const,
      reward: 1000000,
      joinedAt: "14/06/2026",
      note: "Chương trình Tâm An Business định kỳ",
      orders: [
        {
          id: "ro-22",
          serviceLabel: "Tâm An Business - đợt 1 (20 người)",
          amount: 2500000,
          commission: 500000,
          status: "COMPLETED" as const,
          date: "16/06/2026",
          isoDate: "2026-06-16",
          category: "BUSINESS" as const,
        },
        {
          id: "ro-23",
          serviceLabel: "Tâm An Business - đợt 2 (22 người)",
          amount: 2600000,
          commission: 500000,
          status: "COMPLETED" as const,
          date: "30/06/2026",
          isoDate: "2026-06-30",
          category: "BUSINESS" as const,
        },
        {
          id: "ro-24",
          serviceLabel: "Tâm An Business - đợt 3 (dự kiến 20 người)",
          amount: 2500000,
          commission: 500000,
          status: "SCHEDULED" as const,
          date: "14/08/2026",
          isoDate: "2026-08-14",
          category: "BUSINESS" as const,
        },
      ],
    },
    {
      name: "Công ty Fintech XYZ",
      status: "COMPLETED" as const,
      reward: 1000000,
      joinedAt: "28/06/2026",
      note: "Chương trình Tâm An Business hàng tuần",
      orders: [
        {
          id: "ro-25",
          serviceLabel: "Tâm An Business - buổi 1 (15 người)",
          amount: 1125000,
          commission: 250000,
          status: "COMPLETED" as const,
          date: "02/07/2026",
          isoDate: "2026-07-02",
          category: "BUSINESS" as const,
        },
        {
          id: "ro-26",
          serviceLabel: "Tâm An Business - buổi 2 (18 người)",
          amount: 1350000,
          commission: 250000,
          status: "COMPLETED" as const,
          date: "09/07/2026",
          isoDate: "2026-07-09",
          category: "BUSINESS" as const,
        },
        {
          id: "ro-27",
          serviceLabel: "Tâm An Business - buổi 3 (16 người)",
          amount: 1200000,
          commission: 250000,
          status: "COMPLETED" as const,
          date: "23/07/2026",
          isoDate: "2026-07-23",
          category: "BUSINESS" as const,
        },
        {
          id: "ro-28",
          serviceLabel: "Tâm An Business - buổi 4 (20 người)",
          amount: 1500000,
          commission: 250000,
          status: "COMPLETED" as const,
          date: "30/07/2026",
          isoDate: "2026-07-30",
          category: "BUSINESS" as const,
        },
      ],
    },
    {
      name: "Thanh Hằng",
      status: "PENDING" as const,
      reward: 0,
      joinedAt: "18/07/2026",
      note: "Đã đặt lịch, chờ hoàn thành buổi đầu",
      orders: [
        {
          id: "ro-12",
          serviceLabel: "Body Massage 60 phút",
          amount: 250000,
          commission: 50000,
          status: "SCHEDULED" as const,
          date: "20/07/2026",
          isoDate: "2026-07-20",
          category: "INDIVIDUAL" as const,
        },
      ],
    },
    {
      name: "Việt Hoàng",
      status: "PENDING" as const,
      reward: 0,
      joinedAt: "18/07/2026",
      note: "Chờ đặt lịch đầu tiên",
      orders: [],
    },
  ] as ReferralFriend[],
};

export type WalletBill = {
  label: string;
  date: string;
  time: string;
  scheduledTime?: string;
  actualCheckinTime?: string;
  serviceDurationMin?: number;
  therapistName?: string;
  amount: number;
  bookingCode: string;
  note?: string;
};

export const walletSpending = {
  monthly: [
    { month: "T2", amount: 100000 },
    { month: "T3", amount: 0 },
    { month: "T4", amount: 250000 },
    { month: "T5", amount: 0 },
    { month: "T6", amount: 350000 },
    { month: "T7", amount: 35000 },
  ],
  bills: [
    {
      label: "Giác hơi",
      date: "15/02/2026",
      time: "10:42",
      scheduledTime: "10:00 15/02/2026",
      actualCheckinTime: "10:00 15/02/2026",
      serviceDurationMin: 20,
      therapistName: "KTV Hương",
      amount: 100000,
      bookingCode: "TAC-DEMO-006",
    },
    {
      label: "Body Massage 60 phút",
      date: "20/04/2026",
      time: "16:35",
      scheduledTime: "15:30 20/04/2026",
      actualCheckinTime: "15:30 20/04/2026",
      serviceDurationMin: 60,
      therapistName: "KTV Dung",
      amount: 250000,
      bookingCode: "TAC-DEMO-001",
    },
    {
      label: "Vai gáy chuyên sâu - đắp thuốc 60 phút",
      date: "27/06/2026",
      time: "19:00",
      scheduledTime: "18:00 27/06/2026",
      actualCheckinTime: "18:00 27/06/2026",
      serviceDurationMin: 60,
      therapistName: "KTV Dung",
      amount: 350000,
      bookingCode: "TAC-DEMO-005",
    },
    {
      label: "Đặt cọc - Body Massage 90 phút",
      date: formatUtcDDMMYYYY(addDaysUtc(today, 3)),
      time: "09:15",
      scheduledTime: `15:00 ${formatUtcDDMMYYYY(addDaysUtc(today, 3))}`,
      serviceDurationMin: 90,
      therapistName: "KTV Dung",
      amount: 35000,
      bookingCode: "TAC-DEMO-004",
      note: "Đã đặt chỗ - chưa sử dụng",
    },
  ] as WalletBill[],
};

export const vouchers = [
  {
    code: "WELCOME100",
    name: "Thành viên mới nhận 100K",
    description: "Tạo tài khoản để nhận 100.000đ cho lần đặt dịch vụ đầu tiên tại Tâm An Center.",
    type: "FIXED" as const,
    value: 100000,
    usage: "0/500",
    minSpend: 200000,
    expiresAt: formatUtcDDMMYYYY(addDaysUtc(today, 90)),
    constraint: "Một lần cho mỗi tài khoản mới",
    accent: "#8f241d",
    active: true,
  },
  {
    code: "FIRST60",
    name: "Ưu đãi khách mới 60 phút",
    description: "Dành cho khách đặt lịch lần đầu tại Tâm An Center, áp dụng cho dịch vụ từ 60 phút trở lên.",
    type: "FIXED" as const,
    value: 50000,
    usage: "18/100",
    minSpend: 200000,
    expiresAt: formatUtcDDMMYYYY(addDaysUtc(today, 21)),
    constraint: "Khách mới, mọi khung giờ",
    accent: "#9f1d20",
    active: true,
  },
  {
    code: "SANG70",
    name: "Thư giãn buổi sáng trước 12h",
    description: "Giảm 70.000đ cho lịch bắt đầu trước 12:00, giúp bạn chủ động chọn khung giờ yên tĩnh trong ngày.",
    type: "FIXED" as const,
    value: 70000,
    usage: "36/200",
    minSpend: 200000,
    expiresAt: formatUtcDDMMYYYY(addDaysUtc(today, 30)),
    constraint: "Lịch bắt đầu trước 12:00",
    accent: "#b9862c",
    active: true,
  },
  {
    code: "OFFICE20",
    name: "Voucher sau Tâm An Business",
    description: "Tặng ngay sau khi tham gia Tâm An Business tại văn phòng, dùng cho lần đặt lịch tiếp theo.",
    type: "FIXED" as const,
    value: 20000,
    usage: "44/300",
    minSpend: 100000,
    expiresAt: formatUtcDDMMYYYY(addDaysUtc(today, 14)),
    constraint: "Trong 14 ngày, mọi khung giờ",
    accent: "#7a3e1d",
    active: true,
  },
  {
    code: "RETURN7",
    name: "Quay lại sau 7 ngày",
    description: "Giảm 10% khi đặt lịch trong vòng 7 ngày kể từ lần ghé gần nhất, tối đa 50.000đ.",
    type: "PERCENT" as const,
    value: 10,
    usage: "11/100",
    minSpend: 150000,
    expiresAt: formatUtcDDMMYYYY(addDaysUtc(today, 7)),
    constraint: "Trừ Thứ 7, Chủ nhật",
    accent: "#b4232b",
    active: true,
  },
  {
    code: "DUYTAN50",
    name: "Khu văn phòng Duy Tân",
    description: "Ưu đãi riêng cho khách văn phòng khu vực lân cận, xuất trình thẻ nhân viên tại quầy.",
    type: "FIXED" as const,
    value: 50000,
    usage: "27/200",
    minSpend: 200000,
    expiresAt: formatUtcDDMMYYYY(addDaysUtc(today, 30)),
    constraint: "11:00-14:00, giờ nghỉ trưa",
    accent: "#8a5a12",
    active: false,
  },
];

export const campaigns = [
  { code: "FB-TT-BODY60", name: "Facebook Tâm An Center", source: "Facebook Ads", bookings: 32, completed: 21, revenue: 6300000, cost: 1800000 },
  { code: "TT-VAIGAY-OFFICE", name: "TikTok Vai Gáy Dân Văn Phòng", source: "TikTok Ads", bookings: 26, completed: 17, revenue: 5100000, cost: 1300000 },
  { code: "GG-TAMAN", name: "Google Tâm An Center", source: "Google", bookings: 19, completed: 15, revenue: 4800000, cost: 950000 },
  { code: "OFFICE-CMC", name: "Office CMC Business", source: "Office QR", bookings: 44, completed: 28, revenue: 3920000, cost: 600000 },
  { code: "KOC-LOCAL", name: "KOC Local Review", source: "KOC", bookings: 11, completed: 8, revenue: 2600000, cost: 500000 },
];

export const packagePlans = [
  {
    id: "pkg-3",
    name: "Gói 3 buổi",
    paidSessions: 3,
    bonusSessions: 0,
    sessions: 3,
    price: 750000,
    validityDays: 45,
    sold: 8,
    badge: null,
    highlight: false,
  },
  {
    id: "pkg-5",
    name: "Gói 5 buổi",
    paidSessions: 5,
    bonusSessions: 0,
    sessions: 5,
    price: 1200000,
    validityDays: 75,
    sold: 16,
    badge: null,
    highlight: false,
  },
  {
    id: "pkg-9",
    name: "Gói dài hạn 9+1",
    paidSessions: 9,
    bonusSessions: 1,
    sessions: 10,
    price: 2100000,
    validityDays: 150,
    sold: 21,
    badge: "Mua 9 tặng 1",
    highlight: true,
  },
  {
    id: "pkg-19",
    name: "Combo tập thể 19+3",
    paidSessions: 19,
    bonusSessions: 3,
    sessions: 22,
    price: 4180000,
    validityDays: 240,
    sold: 12,
    badge: "1 người mua · tập thể dùng",
    highlight: true,
  },
  {
    id: "pkg-29",
    name: "Gói dài hạn 29+5",
    paidSessions: 29,
    bonusSessions: 5,
    sessions: 34,
    price: 6300000,
    validityDays: 365,
    sold: 6,
    badge: "Mua 29 tặng 5",
    highlight: true,
  },
  {
    id: "pkg-49",
    name: "Gói dài hạn 49+10",
    paidSessions: 49,
    bonusSessions: 10,
    sessions: 59,
    price: 10325000,
    validityDays: 540,
    sold: 3,
    badge: "Mua 49 tặng 10",
    highlight: true,
  },
];

export const depositPolicy = {
  percent: 10,
  description: "Cọc nền tảng bằng 10% giá trị Bill ban đầu trước ưu đãi; phần còn lại bằng 90% giá trị ban đầu trừ ưu đãi.",
};

export const reminders = [
  { customer: "Minh Anh", phone: "0901234567", type: "RETURN_7D", dueAt: addHours(today, 2), title: "Gợi ý đặt lại sau 7 ngày", status: "OPEN" },
  { customer: "Thu Hà", phone: "0987654321", type: "RETURN_14D", dueAt: addDays(today, 1), title: "Nhắc đặt lại KTV Mai", status: "OPEN" },
  { customer: "Hoàng Nam", phone: "0912345678", type: "POST_CARE_3D", dueAt: addDays(today, 3), title: "Hỏi tình trạng cổ vai gáy", status: "OPEN" },
  { customer: "Nguyễn Linh", phone: "0977000111", type: "PACKAGE_1_LEFT", dueAt: addDays(today, 4), title: "Gói chỉ còn 1 buổi", status: "OPEN" },
];

export const officeEvents = [
  {
    eventCode: "CMC-LUNCH-RESET",
    companyName: "CMC Tower",
    location: "Duy Tân, Cầu Giấy",
    startsAt: addDays(at(11), 2),
    endsAt: addDays(at(14), 2),
    registered: 28,
    checkedIn: 0,
    voucherCode: "OFFICE20",
  },
  {
    eventCode: "FPT-LUNCH-RESET",
    companyName: "FPT Cầu Giấy",
    location: "Pham Van Bach",
    startsAt: addDays(at(11), 7),
    endsAt: addDays(at(14), 7),
    registered: 18,
    checkedIn: 0,
    voucherCode: "OFFICE20",
  },
];

export type CorporateTrialPackage = {
  id: string;
  durationMin: number;
  pricePerPerson: number;
  name: string;
  description: string;
};

export const corporateTrialPackages: CorporateTrialPackage[] = [
  {
    id: "trial-15",
    durationMin: 15,
    pricePerPerson: 75000,
    name: "Trải nghiệm nhanh 15 phút",
    description: "Bấm huyệt cổ - vai - gáy nhanh gọn ngay tại bàn làm việc hoặc phòng nghỉ.",
  },
  {
    id: "trial-20",
    durationMin: 20,
    pricePerPerson: 95000,
    name: "Trải nghiệm tiêu chuẩn 20 phút",
    description: "Massage cổ vai gáy kết hợp bấm huyệt đầu, thư giãn sâu hơn cho giờ nghỉ trưa.",
  },
  {
    id: "trial-30",
    durationMin: 30,
    pricePerPerson: 150000,
    name: "Trải nghiệm chuyên sâu 30 phút",
    description: "Massage lưng - vai - gáy trên ghế chuyên dụng, giải toả căng cơ sau nhiều giờ ngồi máy tính.",
  },
];

export type CorporatePackageTier = {
  id: string;
  name: string;
  sessionsPerMonth: number;
  discountPercent: number;
  bonusSessions: number;
  minHeadcountPerSession: number;
  maxHeadcountPerSession: number;
  perks: string[];
  highlight?: boolean;
};

export const corporatePackageTiers: CorporatePackageTier[] = [
  {
    id: "corp-starter",
    name: "Gói Khởi động",
    sessionsPerMonth: 4,
    discountPercent: 10,
    bonusSessions: 0,
    minHeadcountPerSession: 8,
    maxHeadcountPerSession: 15,
    perks: ["1 buổi onsite / tuần", "Giảm 10% so với giá đặt lẻ", "Đổi lịch linh hoạt trước 24 giờ"],
  },
  {
    id: "corp-active",
    name: "Gói Năng động",
    sessionsPerMonth: 8,
    discountPercent: 15,
    bonusSessions: 1,
    minHeadcountPerSession: 10,
    maxHeadcountPerSession: 20,
    perks: ["2 buổi onsite / tuần", "Giảm 15% và tặng 1 buổi/tháng", "Ưu tiên chọn khung giờ đẹp", "2 KTV quen mặt cố định"],
    highlight: true,
  },
  {
    id: "corp-complete",
    name: "Gói Toàn diện",
    sessionsPerMonth: 12,
    discountPercent: 20,
    bonusSessions: 2,
    minHeadcountPerSession: 15,
    maxHeadcountPerSession: 30,
    perks: ["3 buổi onsite / tuần", "Giảm 20% và tặng 2 buổi/tháng", "Miễn phí di chuyển mọi buổi", "Báo cáo chăm sóc sức khoẻ nhân sự hàng quý"],
  },
];

export const corporateTransportFee = {
  feePerTherapist: 50000,
  note: "Phí di chuyển 50.000 đ/KTV/lượt — hệ thống tự tính số KTV phù hợp theo đơn hàng của bạn để điều phối dịch vụ. Miễn phí toàn bộ khi đăng ký Gói Toàn diện.",
};

export const dashboard = {
  todayBookings: bookings.length,
  completedBookings: bookings.filter((booking) => booking.status === "COMPLETED").length,
  upcomingBookings: bookings.filter((booking) => booking.status === "CONFIRMED").length,
  cancelledBookings: 0,
  newCustomers: 2,
  returningCustomers: 5,
  expectedRevenue: bookings.reduce((sum, booking) => sum + booking.totalAmount, 0),
  completedRevenue: bookings.filter((booking) => booking.status === "COMPLETED").reduce((sum, booking) => sum + booking.totalAmount, 0),
  roomUtilization: 58,
  therapistUtilization: 64,
};

export const adminSections = {
  bookings: "Đặt lịch",
  calendar: "Lịch vận hành",
  capacity: "Công suất",
  customers: "Khách hàng",
  therapists: "Kỹ thuật viên",
  services: "Dịch vụ",
  rooms: "Phòng & giường",
  vouchers: "Voucher",
  packages: "Gói dài hạn",
  campaigns: "Chiến dịch",
  reminders: "Chăm sóc lại",
  "office-events": "Doanh nghiệp",
  reports: "Báo cáo",
  settings: "Cấu hình",
};
