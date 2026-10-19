import { toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { getAssetForDownload } from "@/server/assets/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const { asset, body } = await getAssetForDownload(actor, id);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": asset.mime ?? "application/octet-stream",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${encodeURIComponent(asset.filename ?? "asset")}"`,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
