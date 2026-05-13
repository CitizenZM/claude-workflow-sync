import { NextResponse } from "next/server";
import { parseDashboardMd, loadDashboardMd } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const md = loadDashboardMd();
  const data = parseDashboardMd(md);
  return NextResponse.json(data);
}
