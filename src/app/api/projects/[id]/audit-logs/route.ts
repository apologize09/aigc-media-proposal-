import { AuthDeniedError } from "@/server/auth/permissions";
import { isAdmin } from "@/server/auth/permissions";
import { toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { listProjectAudit } from "@/server/audit/service";
import { assertCanViewProject } from "@/server/projects/access";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    if (!isAdmin(actor)) {
      throw new AuthDeniedError("仅管理员可查看审计");
    }
    const { id } = await context.params;
    await assertCanViewProject(actor, id);
    const logs = await listProjectAudit(id);
    return Response.json(
      { logs },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
