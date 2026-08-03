import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  BedDouble,
  BellRing,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChartNoAxesCombined,
  Gauge,
  Megaphone,
  PackageOpen,
  Settings2,
  Sparkles,
  TicketPercent,
  UsersRound,
} from "lucide-react";
import type { AdminSectionSlug } from "@/lib/admin-auth";

export type AdminSectionMeta = {
  label: string;
  shortDescription: string;
  description: string;
  icon: LucideIcon;
};

export const ADMIN_SECTION_META: Record<AdminSectionSlug, AdminSectionMeta> = {
  bookings: { label: "Đặt lịch", shortDescription: "Đơn & trạng thái", description: "Theo dõi đặt cọc, check-in, phục vụ và thanh toán của từng booking.", icon: CalendarCheck },
  calendar: { label: "Lịch vận hành", shortDescription: "Theo ngày & giờ", description: "Sắp xếp lịch phục vụ theo thời gian, cơ sở và nguồn lực đang có.", icon: CalendarDays },
  capacity: { label: "Công suất", shortDescription: "Tải vận hành", description: "Kiểm soát khả năng tiếp nhận theo phòng, giường và khung giờ.", icon: Gauge },
  customers: { label: "Khách hàng", shortDescription: "Hồ sơ & chi tiêu", description: "Quản lý hồ sơ, lịch sử sử dụng, phân nhóm và tổng chi tiêu của khách.", icon: UsersRound },
  therapists: { label: "Kỹ thuật viên", shortDescription: "Lịch & đánh giá", description: "Theo dõi chuyên môn, số lượt phục vụ, khách đặt lại và điểm đánh giá.", icon: BadgeCheck },
  services: { label: "Dịch vụ", shortDescription: "Giá & thời lượng", description: "Quản lý danh mục dịch vụ, thời lượng, giá bán và trạng thái nhận lịch.", icon: Sparkles },
  rooms: { label: "Phòng & giường", shortDescription: "Tài nguyên cơ sở", description: "Theo dõi trạng thái hoạt động và khả năng đáp ứng của từng tài nguyên.", icon: BedDouble },
  vouchers: { label: "Voucher", shortDescription: "Mã & số lượt", description: "Kiểm soát mức giảm, điều kiện áp dụng và số lượng voucher còn lại.", icon: TicketPercent },
  packages: { label: "Gói dài hạn", shortDescription: "Buổi & hạn dùng", description: "Quản lý giá gói, số buổi tặng, thời hạn và lượng gói đã bán.", icon: PackageOpen },
  campaigns: { label: "Chiến dịch", shortDescription: "Nguồn khách", description: "Đối chiếu nguồn quảng bá, lượng booking, doanh thu và chi phí thu hút khách.", icon: Megaphone },
  reminders: { label: "Chăm sóc lại", shortDescription: "Nhắc & quay lại", description: "Tổ chức các mốc chăm sóc sau dịch vụ mà không làm phiền khách hàng.", icon: BellRing },
  "office-events": { label: "Doanh nghiệp", shortDescription: "Sự kiện văn phòng", description: "Quản lý chương trình Tâm An Business, đăng ký nhân sự và voucher liên quan.", icon: Building2 },
  reports: { label: "Báo cáo", shortDescription: "Doanh thu & hiệu quả", description: "Tổng hợp hiệu quả vận hành, doanh thu và chất lượng theo phạm vi quản lý.", icon: ChartNoAxesCombined },
  settings: { label: "Cấu hình", shortDescription: "Quyền & hệ thống", description: "Thiết lập chi nhánh, phân quyền, thông báo và các tính năng hỗ trợ vận hành.", icon: Settings2 },
};

export const ADMIN_SECTION_GROUPS: Array<{ label: string; sections: AdminSectionSlug[] }> = [
  { label: "Vận hành", sections: ["bookings", "calendar", "capacity", "rooms"] },
  { label: "Khách hàng & đội ngũ", sections: ["customers", "therapists", "services", "reminders"] },
  { label: "Ưu đãi & tăng trưởng", sections: ["vouchers", "packages", "campaigns", "office-events"] },
  { label: "Kiểm soát hệ thống", sections: ["reports", "settings"] },
];
