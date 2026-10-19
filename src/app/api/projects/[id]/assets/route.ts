import { AuthValidationError, toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { listAssets, uploadAsset } from "@/server/assets/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    const assets = await listAssets(actor, id);
    return Response.json(
      { assets },
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
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AuthValidationError("缺少文件");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const asset = await uploadAsset({
      actor,
      projectId: id,
      filename: file.name || "upload.bin",
      mime: file.type || "application/octet-stream",
      bytes,
    });
    return Response.json({ asset }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
