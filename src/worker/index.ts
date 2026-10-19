import { processJob } from "../server/ai/jobs";
import { readModelConfig } from "../server/config";
import { prisma } from "../server/db";

const model = readModelConfig();

async function drainQueuedJobs(limit = 20) {
  const jobs = await prisma.aiJob.findMany({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  for (const job of jobs) {
    await processJob(job.id);
  }
  return jobs.length;
}

async function main() {
  if (!process.env.REDIS_URL) {
    console.log("worker：REDIS_URL 未配置，使用进程内轮询 queued 任务");
  } else {
    console.log("worker：已配置 REDIS_URL；本期仍与进程内路径共用 processJob");
  }

  if (!model.configured && process.env.AI_USE_FIXTURE !== "1") {
    console.log(`worker 模型提示：${model.reason}（可用 AI_USE_FIXTURE=1）`);
  }

  const processed = await drainQueuedJobs();
  console.log(`worker 处理排队任务数：${processed}`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
