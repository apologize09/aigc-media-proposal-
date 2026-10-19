import { toErrorResponse } from "@/server/auth/http";
import { requireAuthUser } from "@/server/auth/service";
import { assertCanViewProject } from "@/server/projects/access";
import { listProjectSearches } from "@/server/search/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireAuthUser(request.headers.get("cookie"));
    const { id } = await context.params;
    await assertCanViewProject(actor, id);
    const searches = await listProjectSearches(id);
    return Response.json(
      {
        searches: searches.map((run) => ({
          id: run.id,
          query: run.query,
          provider: run.provider,
          status: run.status,
          createdAt: run.createdAt.toISOString(),
          hits: run.hits.map((hit) => ({
            id: hit.id,
            title: hit.title,
            url: hit.url,
            snippet: hit.snippet,
            mediaType: hit.mediaType,
            selection: hit.selection,
            assetId: hit.assetId,
          })),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
