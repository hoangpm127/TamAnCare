import { addDays, addHours } from "date-fns";

export function reminderSchedule(completedAt: Date) {
  return [
    {
      type: "REVIEW_1H",
      title: "Xin đánh giá sau buổi",
      message: "Hỏi khách về trải nghiệm và đánh giá KTV.",
      dueAt: addHours(completedAt, 1),
    },
    {
      type: "POST_CARE_3D",
      title: "Hỏi tình trạng cơ thể",
      message: "Chăm sóc sau dịch vụ và ghi nhận phản hồi.",
      dueAt: addDays(completedAt, 3),
    },
    {
      type: "RETURN_7D",
      title: "Gợi ý đặt lại sau 7 ngày",
      message: "Mời khách quay lại với ưu đãi phù hợp.",
      dueAt: addDays(completedAt, 7),
    },
    {
      type: "RETURN_14D",
      title: "Nhắc đặt lại KTV yêu thích",
      message: "Ưu tiên gợi ý KTV cũ nếu còn lịch trống.",
      dueAt: addDays(completedAt, 14),
    },
    {
      type: "RETURN_30D",
      title: "Chiến dịch kéo khách cũ",
      message: "Khách 30 ngày chưa quay lại cần được chăm sóc.",
      dueAt: addDays(completedAt, 30),
    },
  ];
}
