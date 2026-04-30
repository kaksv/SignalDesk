import { NextResponse } from "next/server";
import { backendRequest } from "../../../../../lib/backend";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await backendRequest(`/markets/${id}/trades`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { error: "trade_submission_failed", message: (error as Error).message },
      { status: 500 }
    );
  }
}
