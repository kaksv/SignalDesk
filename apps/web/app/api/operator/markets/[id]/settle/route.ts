import { NextResponse } from "next/server";
import { backendRequest, getOperatorHeaders } from "../../../../../../lib/backend";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await backendRequest(`/markets/${id}/settle`, {
      method: "POST",
      headers: getOperatorHeaders(),
      body: JSON.stringify(body)
    });
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { error: "operator_settle_failed", message: (error as Error).message },
      { status: 500 }
    );
  }
}
