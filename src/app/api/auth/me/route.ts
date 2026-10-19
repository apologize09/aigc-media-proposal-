import { toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser(request.headers.get("cookie"));
    return Response.json(
      { user },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
