import { AuthValidationError, toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { reviewSnapshot } from "@/server/review/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    let body: { decision?: string; comment?: string };
    try {
      body = (await request.json()) as { decision?: string; comment?: string };
    } catch {
      throw new AuthValidationError("请求体无效");
    }
    if (
      body.decision !== "approved" &&
      body.decision !== "changes_requested"
    ) {
      throw new AuthValidationError("审核结论无效");
    }
    const review = await reviewSnapshot({
      actor,
      snapshotId: id,
      decision: body.decision,
      comment: body.comment,
    });
    return Response.json({ review }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
