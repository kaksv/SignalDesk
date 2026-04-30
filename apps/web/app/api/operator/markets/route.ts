import { NextResponse } from "next/server";
import { backendRequest, getOperatorHeaders } from "../../../../lib/backend";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await backendRequest("/markets", {
      method: "POST",
      headers: getOperatorHeaders(),
      body: JSON.stringify(body)
    });
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { error: "operator_create_failed", message: (error as Error).message },
      { status: 500 }
    );
  }
}
