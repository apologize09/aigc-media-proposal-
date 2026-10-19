import { prisma } from "../src/server/db";

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    throw new Error("usage: tsx scripts/inspect-jobs.ts <projectId>");
  }
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  console.log("project", project ? project.title : null);
  const jobs = await prisma.aiJob.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  for (const job of jobs) {
    const output = job.output as Record<string, unknown> | null;
    console.log({
      type: job.type,
      status: job.status,
      error: job.error?.slice(0, 160) ?? null,
      hitCount: Array.isArray(output?.searchHits)
        ? output.searchHits.length
        : null,
      blockCount: Array.isArray(output?.blocks) ? output.blocks.length : null,
    });
  }
  const searches = await prisma.searchRun.count({ where: { projectId } });
  const draft = await prisma.proposalDraft.findUnique({ where: { projectId } });
  console.log({ searchRuns: searches, hasDraft: Boolean(draft) });
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
