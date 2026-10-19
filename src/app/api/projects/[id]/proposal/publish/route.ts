import { toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { publishProposal } from "@/server/proposal/publish";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const snapshot = await publishProposal(actor, id);
    return Response.json({ snapshot }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
