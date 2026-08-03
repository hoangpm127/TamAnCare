import { CustomerAccountClient } from "./customer-account-client";
import { safeCustomerReturnPath } from "@/lib/safe-return-path";
import { customerOAuthIsAvailable } from "@/lib/server/customer-oauth";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomerAccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const oauth = first(query.oauth);
  const oauthError = first(query.oauthError);
  const returnTo = safeCustomerReturnPath(first(query.returnTo));
  const provider = first(query.provider) === "facebook" ? "Facebook" : "Google";
  const oauthProvider = first(query.provider) === "facebook" ? "facebook" : "google";
  const availableSocialProviders = (["google", "facebook"] as const).filter(customerOAuthIsAvailable);
  let oauthMessage = "";
  if (oauth === "linked") oauthMessage = `Đã liên kết tài khoản ${provider}.`;
  if (oauth === "success") oauthMessage = `Đã đăng nhập bằng ${provider}.`;
  if (oauthError === "cancelled") oauthMessage = "Bạn đã hủy đăng nhập mạng xã hội.";
  if (oauthError === "already-linked") oauthMessage = `Tài khoản ${provider} này đã liên kết với một khách hàng khác.`;
  if (oauthError === "provider-unavailable") oauthMessage = `${provider} chưa được cấu hình. Vui lòng thử lại sau.`;
  if (oauthError === "rate-limited") oauthMessage = "Có quá nhiều lần thử đăng nhập. Vui lòng thử lại sau.";
  if (oauthError === "failed") oauthMessage = `Không thể hoàn tất đăng nhập ${provider}. Vui lòng thử lại.`;

  return (
    <CustomerAccountClient
      initialOauthCompletion={oauth === "complete"}
      initialOauthMessage={oauthMessage}
      cleanOauthQuery={Boolean(oauth || oauthError)}
      availableSocialProviders={availableSocialProviders}
      oauthProvider={oauthProvider}
      returnTo={returnTo}
    />
  );
}
