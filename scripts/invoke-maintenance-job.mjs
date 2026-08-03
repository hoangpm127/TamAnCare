function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Thiếu ${name}.`);
  return value;
}

async function main() {
  const appUrl = required("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
  const cronSecret = required("CRON_SECRET");
  const response = await fetch(`${appUrl}/api/jobs/maintenance`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cronSecret}` },
    signal: AbortSignal.timeout(50_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? `Tác vụ maintenance trả HTTP ${response.status}.`);
  console.log(`Maintenance hoàn tất lúc ${payload?.completedAt ?? new Date().toISOString()}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
