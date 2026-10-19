import { toErrorResponse } from "@/server/auth/http";
import { createUser, listUsers, requireAdminUser } from "@/server/auth/service";

export async function GET(request: Request) {
  try {
    const actor = await requireAdminUser(request.headers.get("cookie"));
    const users = await listUsers(actor);
    return Response.json(
      { users },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminUser(request.headers.get("cookie"));
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      password?: string;
      roles?: unknown;
      financeAccess?: boolean;
    };

    const user = await createUser({
      actor,
      email: body.email ?? "",
      name: body.name ?? "",
      password: body.password ?? "",
      roles: body.roles,
      financeAccess: body.financeAccess === true,
    });

    return Response.json({ user }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
