import { AuthValidationError, toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { createAndRunJob } from "@/server/ai/jobs";
import { assertCanMutateProject } from "@/server/projects/access";
import { addManualReference } from "@/server/search/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    await assertCanMutateProject(actor, id);
    let body: { url?: string; title?: string; transfer?: boolean };
    try {
      body = (await request.json()) as {
        url?: string;
        title?: string;
        transfer?: boolean;
      };
    } catch {
      throw new AuthValidationError("请求体无效");
    }
    if (!body.url?.trim()) {
      throw new AuthValidationError("缺少链接");
    }
    const { hit } = await addManualReference({
      projectId: id,
      actorId: actor.id,
      url: body.url.trim(),
      title: body.title,
    });

    let job = null;
    if (body.transfer !== false) {
      job = await createAndRunJob({
        actor,
        projectId: id,
        type: "transfer_asset",
        payload: { url: body.url.trim(), title: body.title, hitId: hit.id },
      });
    }

    return Response.json({ hit, job }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
