import "server-only";

import { createHash } from "node:crypto";

export type LegalDocumentSection = {
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
};

export type LegalDocument = {
  type: "TERMS" | "PRIVACY" | "BOOKING_POLICY" | "MARKETING";
  title: string;
  version: string;
  effectiveDate: string;
  summary: string;
  sections: readonly LegalDocumentSection[];
};

export const LEGAL_APPROVAL_REQUIRED =
  "Bản dự thảo vận hành. Tâm An Center phải bổ sung thông tin pháp nhân, đầu mối liên hệ và được người có thẩm quyền cùng tư vấn pháp lý phê duyệt trước khi mở bán thật.";

const TERMS: LegalDocument = {
  type: "TERMS",
  title: "Điều khoản sử dụng",
  version: "2026-07-22-draft.1",
  effectiveDate: "22/07/2026 (dự thảo)",
  summary: "Quy định cách khách hàng truy cập, đặt dịch vụ và sử dụng nền tảng Tâm An Center.",
  sections: [
    {
      heading: "1. Chủ thể cung cấp dịch vụ",
      paragraphs: [
        "Tên pháp lý, mã số thuế, địa chỉ trụ sở, số điện thoại và email tiếp nhận khiếu nại của đơn vị vận hành đang chờ Chủ doanh nghiệp bổ sung. Các thông tin này là điều kiện phải hoàn thiện trước khi công bố chính thức.",
      ],
    },
    {
      heading: "2. Phạm vi nền tảng",
      paragraphs: [
        "Tâm An Center hỗ trợ xem thông tin, đặt lịch chăm sóc sức khỏe, thanh toán/đối soát, quản lý quyền lợi thành viên, Affiliate và trao đổi với cơ sở. Dịch vụ chăm sóc không thay thế việc khám, chẩn đoán hoặc điều trị y khoa.",
      ],
    },
    {
      heading: "3. Khách vãng lai và tài khoản thành viên",
      bullets: [
        "Khách có thể xem và đặt lịch mà không cần đăng nhập; hệ thống vẫn cần số điện thoại và thông tin tối thiểu để xác nhận, phục vụ và bảo vệ quyền truy cập booking.",
        "Tài khoản thành viên dùng để lưu lịch sử, quyền lợi, gói dịch vụ và ưu đãi. Người dùng phải cung cấp thông tin đúng, giữ bí mật mật khẩu và báo ngay khi nghi ngờ bị truy cập trái phép.",
        "Ưu đãi tạo tài khoản chỉ áp dụng theo điều kiện hiển thị tại thời điểm sử dụng, không được quy đổi thành tiền mặt nếu chính sách riêng không nêu khác.",
      ],
    },
    {
      heading: "4. Đặt dịch vụ và thanh toán",
      paragraphs: [
        "Giá, ưu đãi, tiền cọc, thời gian giữ chỗ và số tiền còn lại được hiển thị trước khi khách xác nhận. Booking chỉ được xác nhận thanh toán sau khi hệ thống nhận và đối soát giao dịch hợp lệ; ảnh chụp chuyển khoản không tự động được xem là bằng chứng đã thanh toán.",
        "Tiền Tip KTV là khoản tự nguyện ngoài giá dịch vụ và được hạch toán tách biệt khỏi Bill dịch vụ.",
      ],
    },
    {
      heading: "5. Trách nhiệm và hành vi không được phép",
      bullets: [
        "Không giả mạo danh tính, can thiệp hệ thống, chiếm quyền booking, lạm dụng mã ưu đãi hoặc sử dụng nền tảng cho hoạt động trái pháp luật.",
        "Khách cần cung cấp trung thực thông tin sức khỏe có liên quan và tuân thủ hướng dẫn an toàn tại cơ sở.",
        "Tâm An Center có thể tạm dừng tài khoản hoặc giao dịch có dấu hiệu gian lận nhưng phải lưu vết, xem xét và có kênh tiếp nhận phản hồi.",
      ],
    },
    {
      heading: "6. Khiếu nại, gián đoạn và thay đổi",
      paragraphs: [
        "Sự cố kỹ thuật, bất khả kháng hoặc thay đổi vận hành sẽ được xử lý theo mức độ ảnh hưởng và quy định pháp luật áp dụng. Điều khoản mới phải có phiên bản, ngày hiệu lực và được thông báo phù hợp; việc đồng ý phiên bản cũ không tự động trở thành đồng ý cho nội dung mới có thay đổi trọng yếu.",
        "Quy trình giải quyết khiếu nại, thời hạn phản hồi và cơ quan/đơn vị giải quyết tranh chấp sẽ được bổ sung sau khi hoàn thiện thông tin pháp nhân.",
      ],
    },
  ],
};

const PRIVACY: LegalDocument = {
  type: "PRIVACY",
  title: "Chính sách bảo vệ dữ liệu cá nhân",
  version: "2026-07-22-draft.1",
  effectiveDate: "22/07/2026 (dự thảo)",
  summary: "Giải thích dữ liệu nào được xử lý, vì sao cần dùng và khách hàng có thể thực hiện quyền của mình như thế nào.",
  sections: [
    {
      heading: "1. Bên kiểm soát dữ liệu và đầu mối liên hệ",
      paragraphs: [
        "Đơn vị vận hành Tâm An Center dự kiến là bên quyết định mục đích và phương thức xử lý dữ liệu trên nền tảng. Tên pháp lý, địa chỉ, email bảo vệ dữ liệu và số điện thoại tiếp nhận yêu cầu đang chờ Chủ doanh nghiệp phê duyệt; chưa được phép mở bán thật khi thiếu các thông tin này.",
      ],
    },
    {
      heading: "2. Nhóm dữ liệu được xử lý",
      bullets: [
        "Thông tin nhận diện và liên hệ: họ tên, số điện thoại, email (nếu có), thông tin tài khoản.",
        "Thông tin đặt dịch vụ: cơ sở, thời gian, dịch vụ, KTV, người đi cùng, ghi chú chăm sóc và lịch sử thay đổi/no-show.",
        "Thông tin giao dịch: số tiền, trạng thái, mã đối soát và phần Tip KTV; nền tảng không cần lưu mật khẩu ngân hàng của khách.",
        "Thông tin kỹ thuật và an toàn: phiên đăng nhập, thiết bị/trình duyệt, nhật ký truy cập, định danh mạng đã băm và sự kiện bảo mật.",
        "Thông tin tương tác: thông báo, phản hồi, đánh giá, mã Affiliate và mối quan hệ do người dùng chủ động khai báo khi mời bạn/mời sếp.",
      ],
    },
    {
      heading: "3. Mục đích và căn cứ xử lý dự kiến",
      bullets: [
        "Tiếp nhận, giữ chỗ, phục vụ, thanh toán, chăm sóc sau dịch vụ và giải quyết khiếu nại.",
        "Bảo vệ tài khoản, chống gian lận, đối soát tài chính và đáp ứng nghĩa vụ kế toán/pháp lý.",
        "Cá nhân hóa và gửi tiếp thị chỉ khi có căn cứ phù hợp; lựa chọn nhận tiếp thị phải tách riêng và có thể rút lại.",
        "Phân tích vận hành bằng dữ liệu tối thiểu hoặc dữ liệu tổng hợp. Căn cứ pháp lý cụ thể cho từng mục đích phải được tư vấn pháp lý xác nhận trước khi công bố.",
      ],
    },
    {
      heading: "4. Bên nhận dữ liệu và nhà cung cấp",
      paragraphs: [
        "Dữ liệu chỉ được chia sẻ theo nhu cầu công việc với cơ sở/KTV được phân quyền, đơn vị hạ tầng, đối tác thanh toán/đối soát và cơ quan có thẩm quyền khi có yêu cầu hợp pháp. Danh sách nhà cung cấp, vị trí lưu trữ và điều khoản xử lý dữ liệu phải được lập thành hồ sơ trước khi chạy thật.",
        "Tính năng AI nhận diện ảnh chứng từ chỉ dành cho nhân sự được phân quyền xử lý chứng từ chi phí nội bộ. Không được tải lên hồ sơ sức khỏe hoặc dữ liệu khách hàng không cần thiết. Việc dùng nhà cung cấp AI phải được đánh giá bảo mật, chuyển dữ liệu và hợp đồng trước khi bật ở môi trường thật.",
      ],
    },
    {
      heading: "5. Thời hạn lưu trữ và bảo mật",
      paragraphs: [
        "Dữ liệu được lưu trong thời gian cần thiết cho từng mục đích và nghĩa vụ pháp lý. Bảng thời hạn cụ thể cho tài khoản, booking, giao dịch, camera/chứng từ, nhật ký và bản sao lưu đang chờ Chủ doanh nghiệp cùng tư vấn pháp lý duyệt.",
        "Nền tảng áp dụng phân quyền, phiên đăng nhập an toàn, băm định danh, nhật ký kiểm toán và sao lưu. Không hệ thống nào có thể cam kết an toàn tuyệt đối; quy trình phản ứng và thông báo sự cố phải được vận hành trước ngày mở bán.",
      ],
    },
    {
      heading: "6. Quyền của chủ thể dữ liệu",
      bullets: [
        "Được biết, đồng ý hoặc từ chối trong trường hợp pháp luật yêu cầu; được rút lại sự đồng ý mà không làm mất tính hợp pháp của việc xử lý đã thực hiện trước đó.",
        "Yêu cầu truy cập, chỉnh sửa, cung cấp bản sao, hạn chế, phản đối hoặc xóa dữ liệu trong phạm vi pháp luật cho phép.",
        "Khiếu nại và yêu cầu giải thích về quyết định có ảnh hưởng đáng kể. Quy trình xác minh danh tính, thời hạn phản hồi và kênh tiếp nhận phải được công bố trước khi chạy thật.",
      ],
    },
    {
      heading: "7. Cookie, khách chưa đăng nhập và người chưa thành niên",
      paragraphs: [
        "Cookie/phiên thiết yếu được dùng để giữ quyền truy cập booking và bảo vệ giao dịch. Cookie phân tích hoặc quảng cáo không thiết yếu chỉ được bật sau khi có cơ chế lựa chọn phù hợp.",
        "Nền tảng chưa thiết kế để tự thu thập dữ liệu trẻ em. Quy trình xác minh tuổi và đồng ý của người đại diện cần được phê duyệt trước khi phục vụ người chưa thành niên.",
      ],
    },
  ],
};

const BOOKING_POLICY: LegalDocument = {
  type: "BOOKING_POLICY",
  title: "Chính sách đặt lịch, đặt cọc và sử dụng dịch vụ",
  version: "2026-07-22-draft.1",
  effectiveDate: "22/07/2026 (dự thảo)",
  summary: "Các quy tắc vận hành được áp dụng khi khách giữ chỗ, đổi lịch, check-in và hoàn tất thanh toán.",
  sections: [
    {
      heading: "1. Khung giờ phục vụ",
      bullets: [
        "Cơ sở mở cửa từ 08:00 đến 22:00 hằng ngày.",
        "Giờ nhận lịch cuối dự kiến là 21:00; hệ thống chỉ hiển thị khung giờ phù hợp với thời lượng dịch vụ và năng lực còn trống.",
        "Khung giờ hiển thị phụ thuộc đồng thời vào ghế/phòng, KTV, thời gian đệm và trạng thái booking đang giữ chỗ.",
      ],
    },
    {
      heading: "2. Giá và tiền đặt cọc",
      paragraphs: [
        "Tiền cọc bằng 10% tổng Bill sau khi trừ ưu đãi hợp lệ. Hệ thống hiển thị rõ tổng trước giảm, khoản giảm, tổng sau giảm, cọc và số còn lại trước khi khách chuyển khoản.",
        "Khung giờ chỉ được giữ trong thời hạn hiển thị. Booking chưa nhận được khoản cọc hợp lệ có thể tự hết hạn để trả lại năng lực phục vụ. Trạng thái thanh toán căn cứ vào giao dịch ngân hàng đã đối soát.",
      ],
    },
    {
      heading: "3. Đổi lịch và khách không đến",
      bullets: [
        "Mỗi khách được đổi lịch một lần trong một tháng mà không bị mất khoản cọc, với điều kiện thực hiện theo thời hạn thông báo được Tâm An Center công bố.",
        "Từ lần đổi thứ hai trong cùng tháng, khoản cọc trước có thể bị khấu trừ và khách cần đặt cọc lại cho lịch mới.",
        "Khách không đến được áp dụng nguyên tắc tương tự; hệ thống gửi một lời nhắc hỗ trợ đặt lại trong tháng và nhắc lịch tiếp theo theo cách phù hợp.",
        "Nếu khách đến đúng lịch thì không áp dụng phạt cọc theo quy tắc đổi lịch/no-show. Trường hợp lỗi từ cơ sở, bất khả kháng, sức khỏe khẩn cấp hoặc tình huống đặc biệt phải có quy trình xem xét công bằng trước khi khấu trừ.",
      ],
    },
    {
      heading: "4. Check-in, người đi cùng và bố trí phục vụ",
      paragraphs: [
        "Khách có thể dùng QR hoặc mã booking còn hiệu lực để check-in đúng cơ sở. Khi chọn Mời bạn/Mời sếp, thông tin quan hệ và ghi chú bố trí được chuyển cho cơ sở trong phạm vi cần thiết để chủ động xếp vị trí gần nhau; đây không phải cam kết tuyệt đối nếu năng lực phục vụ thay đổi.",
      ],
    },
    {
      heading: "5. Thanh toán còn lại, Tip và chứng từ",
      paragraphs: [
        "Số còn lại của dịch vụ được thanh toán theo Bill sau khi trừ khoản cọc đã đối soát. Tip KTV là tự nguyện, nằm ngoài Bill dịch vụ và được hạch toán riêng để chi trả cho KTV vào cuối ngày theo quy trình nội bộ.",
      ],
    },
    {
      heading: "6. Hủy, hoàn tiền và hỗ trợ",
      paragraphs: [
        "Điều kiện hủy/hoàn tiền, thời hạn xử lý, phương thức hoàn và đầu mối hỗ trợ đang chờ Chủ doanh nghiệp phê duyệt. Không được thu hoặc giữ tiền dựa trên điều khoản chưa được công bố rõ cho khách trước giao dịch.",
      ],
    },
  ],
};

const MARKETING: LegalDocument = {
  type: "MARKETING",
  title: "Lựa chọn nhận thông tin ưu đãi",
  version: "2026-07-22-draft.1",
  effectiveDate: "22/07/2026 (dự thảo)",
  summary: "Sự đồng ý riêng cho nội dung ưu đãi và chăm sóc không thiết yếu đối với việc thực hiện booking.",
  sections: [
    {
      heading: "Phạm vi lựa chọn",
      paragraphs: [
        "Nếu chọn nhận thông tin, Tâm An Center có thể gửi ưu đãi, chương trình thành viên và gợi ý chăm sóc qua kênh liên hệ đã cung cấp. Lựa chọn này không phải điều kiện để tạo tài khoản hoặc đặt dịch vụ và có thể rút lại bất kỳ lúc nào.",
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS = {
  TERMS,
  PRIVACY,
  BOOKING_POLICY,
  MARKETING,
} as const;

export type LegalDocumentType = keyof typeof LEGAL_DOCUMENTS;

export function legalDocumentEvidence(type: LegalDocumentType) {
  const document = LEGAL_DOCUMENTS[type];
  const canonicalContent = JSON.stringify({
    type: document.type,
    title: document.title,
    version: document.version,
    effectiveDate: document.effectiveDate,
    summary: document.summary,
    sections: document.sections,
  });
  return {
    documentType: document.type,
    documentVersion: document.version,
    documentHash: createHash("sha256").update(canonicalContent, "utf8").digest("hex"),
  };
}
