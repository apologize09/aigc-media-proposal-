import {
  hashPassword,
  isPasswordStrongEnough,
} from "../src/server/auth/password";
import { prisma } from "../src/server/db";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const name = process.env.SEED_ADMIN_NAME?.trim() || "管理员";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";

  if (!email || !password) {
    console.error(
      "请设置 SEED_ADMIN_EMAIL 与 SEED_ADMIN_PASSWORD 后再执行种子。",
    );
    process.exit(1);
  }

  if (!isPasswordStrongEnough(password)) {
    console.error("SEED_ADMIN_PASSWORD 至少 10 个字符。");
    process.exit(1);
  }

  const existingCount = await prisma.user.count();
  if (existingCount > 0) {
    console.log("已有账号，跳过种子。");
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      financeAccess: true,
      roles: {
        create: [{ role: "admin" }],
      },
    },
  });

  console.log(`已创建管理员：${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
