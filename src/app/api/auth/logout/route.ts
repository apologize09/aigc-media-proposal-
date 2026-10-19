import { toErrorResponse } from "@/server/auth/http";
import { logoutCurrentSession } from "@/server/auth/service";

export async function POST(request: Request) {
  try {
    const result = await logoutCurrentSession({
      cookieHeader: request.headers.get("cookie"),
    });

    return Response.json(
      { ok: true },
      {
        status: 200,
        headers: {
          "Set-Cookie": result.setCookie,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
