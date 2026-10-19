/**
 * 本地体验账号：管理员（全权限+财务）与方案编辑。
 * 仅用于开发环境，勿用于生产。
 */
import { hashPassword } from "../src/server/auth/password";
import { prisma } from "../src/server/db";

const ACCOUNTS = [
  {
    email: "admin@example.com",
    name: "体验管理员",
    password: "DemoAdmin123!",
    financeAccess: true,
    roles: ["admin", "editor", "reviewer"] as const,
  },
  {
    email: "editor@example.com",
    name: "体验编辑",
    password: "DemoEditor123!",
    financeAccess: true,
    roles: ["editor"] as const,
  },
  {
    email: "reviewer@example.com",
    name: "体验审核",
    password: "DemoReview123!",
    financeAccess: false,
    roles: ["reviewer"] as const,
  },
];

async function upsertAccount(account: (typeof ACCOUNTS)[number]) {
  const passwordHash = await hashPassword(account.password);
  const existing = await prisma.user.findUnique({
    where: { email: account.email },
  });
  if (!existing) {
    const user = await prisma.user.create({
      data: {
        email: account.email,
        name: account.name,
        passwordHash,
        financeAccess: account.financeAccess,
        status: "active",
        roles: {
          create: account.roles.map((role) => ({ role })),
        },
      },
    });
    return { id: user.id, created: true };
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: {
      name: account.name,
      passwordHash,
      financeAccess: account.financeAccess,
      status: "active",
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: existing.id } });
  await prisma.userRole.createMany({
    data: account.roles.map((role) => ({
      userId: existing.id,
      role,
    })),
  });
  return { id: existing.id, created: false };
}

async function main() {
  const admin = await upsertAccount(ACCOUNTS[0]!);
  const editor = await upsertAccount(ACCOUNTS[1]!);
  const reviewer = await upsertAccount(ACCOUNTS[2]!);

  let client = await prisma.client.findFirst({
    where: { name: "体验客户·星河品牌" },
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        name: "体验客户·星河品牌",
        contactName: "王经理",
        contactEmail: "client@example.com",
        contactPhone: "13800000000",
        internalNotes: "演示用客户档案",
        createdById: admin.id,
      },
    });
  }

  let project = await prisma.project.findFirst({
    where: { title: "春季品牌短片提案（体验）" },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        clientId: client.id,
        title: "春季品牌短片提案（体验）",
        brief:
          "需要一支面向年轻用户的品牌短片提案，风格干净专业，包含创意方向、参考案例与制作流程说明。",
        ownerUserId: editor.id,
        createdById: admin.id,
        members: {
          create: [
            { userId: admin.id },
            { userId: editor.id },
            { userId: reviewer.id },
          ],
        },
      },
    });
  } else {
    for (const userId of [admin.id, editor.id, reviewer.id]) {
      await prisma.projectMember.upsert({
        where: {
          projectId_userId: { projectId: project.id, userId },
        },
        create: { projectId: project.id, userId },
        update: {},
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectId: project.id,
        accounts: ACCOUNTS.map((item) => ({
          email: item.email,
          password: item.password,
          roles: item.roles,
          financeAccess: item.financeAccess,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
