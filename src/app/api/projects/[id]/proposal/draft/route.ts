import { AuthValidationError, toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { createAndRunJob } from "@/server/ai/jobs";
import { getDraft, saveDraft } from "@/server/proposal/publish";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const draft = await getDraft(actor, id);
    return Response.json(
      { draft },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    let body: { mode?: string } = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        body = JSON.parse(text) as { mode?: string };
      }
    } catch {
      throw new AuthValidationError("请求体无效");
    }
    const job = await createAndRunJob({
      actor,
      projectId: id,
      type: "draft_proposal",
      payload: { mode: body.mode === "replace" ? "replace" : "create" },
    });
    return Response.json({ job }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    let body: { projectJson?: unknown; expectedUpdatedAt?: string };
    try {
      body = (await request.json()) as {
        projectJson?: unknown;
        expectedUpdatedAt?: string;
      };
    } catch {
      throw new AuthValidationError("请求体无效");
    }
    if (body.projectJson === undefined) {
      throw new AuthValidationError("缺少 projectJson");
    }
    const draft = await saveDraft({
      actor,
      projectId: id,
      projectJson: body.projectJson,
      expectedUpdatedAt: body.expectedUpdatedAt,
    });
    return Response.json({ draft });
  } catch (error) {
    return toErrorResponse(error);
  }
}
