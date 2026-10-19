import { toErrorResponse } from "@/server/auth/http";
import { requireAdminUser, updateUser } from "@/server/auth/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireAdminUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      roles?: unknown;
      financeAccess?: boolean;
      status?: "active" | "disabled";
      password?: string;
    };

    const user = await updateUser({
      actor,
      userId: id,
      name: body.name,
      roles: body.roles,
      financeAccess: body.financeAccess,
      status: body.status,
      password: body.password,
    });

    return Response.json({ user });
  } catch (error) {
    return toErrorResponse(error);
  }
}
