import { AuthValidationError, toErrorResponse } from "@/server/auth/http";
import { loginWithPassword } from "@/server/auth/service";

export async function POST(request: Request) {
  try {
    let body: { email?: string; password?: string };
    try {
      body = (await request.json()) as {
        email?: string;
        password?: string;
      };
    } catch {
      throw new AuthValidationError("请求体无效");
    }

    const result = await loginWithPassword({
      email: body.email ?? "",
      password: body.password ?? "",
      cookieHeader: request.headers.get("cookie"),
    });

    return Response.json(
      { user: result.user },
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
