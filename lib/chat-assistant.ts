import type { CatalogBranch } from "@/lib/catalog-types";

const PHONE_REGEX = /(?:0|\+84)\d{9,10}/;
const ADDRESS_KEYWORDS = ["địa chỉ", "ở đâu", "chỗ nào", "map", "bản đồ", "đường nào"];
const PRICE_OR_SCHEDULE_KEYWORDS = [
  "giá",
  "bao nhiêu",
  "phí",
  "tiền",
  "lịch",
  "giờ",
  "hôm nay",
  "ngày mai",
  "trống",
  "đặt lịch",
  "khung",
];
const GREETING_KEYWORDS = ["chào", "cho hỏi", "tư vấn", "alo", "shop ơi", "cho em hỏi", "cho chị hỏi", "cho anh hỏi"];

export type ChatReplyResult = {
  reply: string;
};

function branchList(branches: CatalogBranch[]) {
  return branches
    .map((branch) => `${branch.label}: ${branch.address} · ${branch.phone}`)
    .join("; ");
}

export function classifyAndReply(rawText: string, branches: CatalogBranch[]): ChatReplyResult {
  const text = rawText.toLowerCase();
  const digitsOnly = rawText.replace(/[\s.().-]/g, "");
  const primaryPhone = branches.find((branch) => branch.phone)?.phone;

  if (PHONE_REGEX.test(digitsOnly)) {
    return {
      reply: `Đây là trợ lý tự động và cuộc trò chuyện này không lưu hay chuyển số điện thoại cho lễ tân. Vui lòng bấm nút gọi hotline${primaryPhone ? ` ${primaryPhone}` : ""} hoặc mở mục Liên hệ để được hỗ trợ trực tiếp.`,
    };
  }

  if (ADDRESS_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return {
      reply: branches.length > 0
        ? `Thông tin cơ sở đang hoạt động: ${branchList(branches)}. Bạn có thể mở mục Liên hệ để xem chỉ đường.`
        : "Thông tin cơ sở đang được cập nhật. Vui lòng mở mục Liên hệ để kiểm tra lại.",
    };
  }

  if (PRICE_OR_SCHEDULE_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return {
      reply: "Giá và lịch trống thay đổi theo dịch vụ, cơ sở và thời điểm. Vui lòng mở Đặt lịch để xem dữ liệu còn chỗ theo thời gian thực; trợ lý này không tự giữ lịch.",
    };
  }

  if (GREETING_KEYWORDS.some((keyword) => text.includes(keyword)) || rawText.trim().length <= 12) {
    return {
      reply: "Xin chào! Mình là trợ lý tự động của Tâm An Center. Mình có thể hướng dẫn bạn xem dịch vụ, lịch trống, địa chỉ và hotline; đây không phải cuộc chat trực tiếp với lễ tân.",
    };
  }

  return {
    reply: "Mình chỉ có thể hướng dẫn thông tin cơ bản. Để được tư vấn trực tiếp, bạn vui lòng mở mục Liên hệ và gọi hotline của cơ sở phù hợp.",
  };
}
