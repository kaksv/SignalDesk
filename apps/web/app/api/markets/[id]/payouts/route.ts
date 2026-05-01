import { NextResponse } from "next/server";
import { backendRequest } from "../../../../../lib/backend";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const result = await backendRequest(`/markets/${id}/payouts`);
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { error: "payouts_fetch_failed", message: (error as Error).message },
      { status: 500 }
    );
  }
}
