import { AuthValidationError, toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { createAndRunJob } from "@/server/ai/jobs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    let body: { blockType?: string; currentBody?: string };
    try {
      body = (await request.json()) as {
        blockType?: string;
        currentBody?: string;
      };
    } catch {
      throw new AuthValidationError("请求体无效");
    }
    if (!body.blockType?.trim()) {
      throw new AuthValidationError("缺少 blockType");
    }
    const job = await createAndRunJob({
      actor,
      projectId: id,
      type: "regenerate_block",
      payload: {
        blockType: body.blockType.trim(),
        currentBody: body.currentBody ?? "",
      },
    });
    return Response.json({ job }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
