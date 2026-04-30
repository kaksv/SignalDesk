import { NextResponse } from "next/server";
import { backendRequest, getOperatorHeaders } from "../../../../../../lib/backend";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await backendRequest(`/markets/${id}/status`, {
      method: "PATCH",
      headers: getOperatorHeaders(),
      body: JSON.stringify(body)
    });
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { error: "operator_status_failed", message: (error as Error).message },
      { status: 500 }
    );
  }
}
