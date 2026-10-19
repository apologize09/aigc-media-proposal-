import { AuthNotFoundError, toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { getJob } from "@/server/ai/jobs";
import { assertCanViewProject } from "@/server/projects/access";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const job = await getJob(id);
    if (!job) {
      throw new AuthNotFoundError("任务不存在");
    }
    await assertCanViewProject(actor, job.projectId);
    return Response.json(
      {
        job: {
          id: job.id,
          projectId: job.projectId,
          type: job.type,
          status: job.status,
          error: job.error,
          output: job.output,
          createdAt: job.createdAt.toISOString(),
          updatedAt: job.updatedAt.toISOString(),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
