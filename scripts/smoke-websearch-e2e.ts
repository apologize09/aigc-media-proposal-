import { setModelAdapterForTests } from "../src/server/ai/adapter";
import { createAndRunJob } from "../src/server/ai/jobs";
import {
  confirmCurrentAnalysis,
  enqueueAnalysis,
} from "../src/server/analysis/service";
import { hashPassword } from "../src/server/auth/password";
import type { AuthUser } from "../src/server/auth/types";
import { prisma } from "../src/server/db";
import { createClient, createProject } from "../src/server/projects/service";
import { getDraft } from "../src/server/proposal/publish";
import { listProjectSearches } from "../src/server/search/service";

async function createAdmin(): Promise<AuthUser> {
  const email = `ark.ws.${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      name: "方舟复测",
      passwordHash: await hashPassword("password-strong-enough"),
      financeAccess: true,
      roles: { create: [{ role: "admin" }, { role: "editor" }] },
    },
    include: { roles: true },
  });
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    financeAccess: user.financeAccess,
    roles: user.roles.map((role) => role.role),
  };
}

async function main() {
  setModelAdapterForTests(null);
  process.env.AI_USE_FIXTURE = "";

  const admin = await createAdmin();
  const client = await createClient({ actor: admin, name: "web_search复测2" });
  const project = await createProject({
    actor: admin,
    clientId: client.id,
    title: "web_search服务层复测",
    brief: "需要一支面向年轻用户的干净专业品牌短片提案",
  });
  console.log("project", project.id);

  console.log("analyze_start", new Date().toISOString());
  const analyzeJob = await enqueueAnalysis(admin, project.id);
  console.log("analyze", {
    status: analyzeJob.status,
    error: analyzeJob.error,
  });
  if (analyzeJob.status !== "succeeded") {
    process.exitCode = 1;
    return;
  }
  await confirmCurrentAnalysis(admin, project.id);

  console.log("draft_start", new Date().toISOString());
  const draftJob = await createAndRunJob({
    actor: admin,
    projectId: project.id,
    type: "draft_proposal",
    payload: { mode: "create" },
  });
  const output = (draftJob.output ?? {}) as {
    blocks?: unknown[];
    searchHits?: Array<{ url: string; title?: string }>;
    searchQueries?: string[];
  };
  console.log("draft", {
    status: draftJob.status,
    error: draftJob.error,
    blocks: output.blocks?.length ?? 0,
    hits: output.searchHits?.length ?? 0,
    queries: output.searchQueries?.slice(0, 6),
    urls: (output.searchHits ?? []).slice(0, 6).map((hit) => hit.url),
  });

  const draft = await getDraft(admin, project.id);
  const searches = await listProjectSearches(project.id);
  console.log("persisted", {
    draftSaved: Boolean(draft),
    searchRuns: searches.length,
    totalHits: searches.reduce((sum, run) => sum + run.hits.length, 0),
    providers: [...new Set(searches.map((run) => run.provider))],
  });

  if (draftJob.status !== "succeeded" || !draft) {
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
