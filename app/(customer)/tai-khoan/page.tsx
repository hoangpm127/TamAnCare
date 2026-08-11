import { CustomerAccountClient } from "./customer-account-client";
import { safeCustomerReturnPath } from "@/lib/safe-return-path";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomerAccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <CustomerAccountClient
      initialMode={first(query.mode) === "login" ? "login" : "register"}
      returnTo={safeCustomerReturnPath(first(query.returnTo))}
    />
  );
}
