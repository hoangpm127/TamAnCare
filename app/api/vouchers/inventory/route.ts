import { NextResponse } from "next/server";
import { getVoucherInventory } from "@/lib/voucher-inventory-server";

export async function GET() {
  return NextResponse.json({ inventory: await getVoucherInventory() });
}
