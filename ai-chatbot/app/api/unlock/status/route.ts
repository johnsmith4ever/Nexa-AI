import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const basicCode = process.env.BASIC_CODE?.trim() || "";
  const proCode = process.env.PRO_CODE?.trim() || "";
  const proPassword = process.env.PRO_PASSWORD || "";

  return NextResponse.json({
    basicCodeSet: basicCode.length > 0,
    basicCodeLength: basicCode.length,
    proCodeSet: proCode.length > 0,
    proCodeLength: proCode.length,
    proPasswordSet: proPassword.length > 0,
    proPasswordLength: proPassword.length,
  });
}
