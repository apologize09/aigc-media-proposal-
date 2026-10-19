import { AuthValidationError, toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { createTask, listTasks } from "@/server/tasks/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const tasks = await listTasks(actor, id);
    return Response.json(
      { tasks },
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
    let body: {
      title?: string;
      detail?: string;
      assigneeUserId?: string;
      snapshotId?: string;
      startOn?: string;
      endOn?: string;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      throw new AuthValidationError("请求体无效");
    }
    if (!body.title?.trim()) {
      throw new AuthValidationError("缺少标题");
    }
    const task = await createTask({
      actor,
      projectId: id,
      title: body.title,
      detail: body.detail,
      assigneeUserId: body.assigneeUserId,
      snapshotId: body.snapshotId,
      startOn: body.startOn,
      endOn: body.endOn,
    });
    return Response.json({ task }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
