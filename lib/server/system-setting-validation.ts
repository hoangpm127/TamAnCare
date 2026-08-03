import "server-only";

export function settingValueError(valueType: string, value: string) {
  if (valueType === "BOOLEAN" && !["true", "false"].includes(value)) return "Giá trị bật/tắt chỉ nhận true hoặc false.";
  if (valueType === "NUMBER" && !Number.isFinite(Number(value))) return "Giá trị phải là một số hợp lệ.";
  if (["MINUTES", "DAYS"].includes(valueType) && (!/^\d+$/.test(value) || Number(value) < 0)) return "Giá trị phải là số nguyên không âm.";
  if (valueType === "PERCENT" && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100)) return "Phần trăm phải nằm trong khoảng 0–100.";
  if (valueType === "TIME" && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return "Giờ phải có định dạng HH:mm.";
  if (valueType === "DATETIME" && Number.isNaN(new Date(value).getTime())) return "Ngày giờ chưa đúng định dạng ISO.";
  if (valueType === "JSON") {
    try {
      JSON.parse(value);
    } catch {
      return "Dữ liệu JSON chưa đúng định dạng.";
    }
  }
  return null;
}
