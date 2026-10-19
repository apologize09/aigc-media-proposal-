import { setModelAdapterForTests } from "../src/server/ai/adapter";
import { createAndRunJob } from "../src/server/ai/jobs";
import { hashPassword } from "../src/server/auth/password";
import type { AuthUser } from "../src/server/auth/types";
import { prisma } from "../src/server/db";
import { createClient, createProject } from "../src/server/projects/service";
import { getDraft } from "../src/server/proposal/publish";
import { listProjectSearches } from "../src/server/search/service";

async function main() {
  setModelAdapterForTests(null);
  process.env.AI_USE_FIXTURE = "";

  const email = `ark.persist.${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      name: "持久化复测",
      passwordHash: await hashPassword("password-strong-enough"),
      financeAccess: true,
      roles: { create: [{ role: "admin" }, { role: "editor" }] },
    },
    include: { roles: true },
  });
  const actor: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    financeAccess: user.financeAccess,
    roles: user.roles.map((role) => role.role),
  };

  const client = await createClient({ actor, name: "persist客户" });
  const project = await createProject({
    actor,
    clientId: client.id,
    title: "persist草稿",
    brief: "需要一支品牌短片",
  });

  await prisma.analysis.create({
    data: {
      projectId: project.id,
      versionNo: 1,
      isCurrent: true,
      confirmedAt: new Date(),
      confirmedById: actor.id,
      payload: {
        summary: "面向年轻用户的品牌短片提案",
        objectives: ["成片提案"],
        audience: "品牌主",
        deliverableNotes: "HTML",
        styleNotes: "干净专业",
        constraints: [],
        openQuestions: [],
        searchQueries: ["AIGC 广告案例", "年轻用户品牌短片"],
      },
    },
  });

  console.log("project", project.id, "drafting...");
  const job = await createAndRunJob({
    actor,
    projectId: project.id,
    type: "draft_proposal",
    payload: { mode: "create" },
  });
  const output = (job.output ?? {}) as {
    blocks?: unknown[];
    searchHits?: Array<{ url: string }>;
    searchQueries?: string[];
  };
  console.log({
    status: job.status,
    error: job.error,
    blocks: output.blocks?.length ?? 0,
    hits: output.searchHits?.length ?? 0,
    urls: (output.searchHits ?? []).slice(0, 4).map((hit) => hit.url),
  });

  const draft = await getDraft(actor, project.id);
  const searches = await listProjectSearches(project.id);
  console.log({
    draftSaved: Boolean(draft),
    searchRuns: searches.length,
    totalHits: searches.reduce((sum, run) => sum + run.hits.length, 0),
  });

  if (job.status !== "succeeded" || !draft || searches.length === 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
