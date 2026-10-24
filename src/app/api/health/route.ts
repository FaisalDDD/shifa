import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "shifa",
    time: new Date().toISOString(),
  });
}
