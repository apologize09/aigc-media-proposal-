import { AuthNotFoundError, toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { prisma } from "@/server/db";
import { assertCanMutateProject } from "@/server/projects/access";
import { dismissSearchHit } from "@/server/search/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const hit = await prisma.searchHit.findUnique({
      where: { id },
      include: { searchRun: true },
    });
    if (!hit) {
      throw new AuthNotFoundError("搜索结果不存在");
    }
    await assertCanMutateProject(actor, hit.searchRun.projectId);
    const updated = await dismissSearchHit(id);
    return Response.json({ hit: { id: updated.id, selection: updated.selection } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
