import { hashPassword } from "../src/server/auth/password";
import { prisma } from "../src/server/db";

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "";
  const name = process.env.SEED_ADMIN_NAME?.trim() || "管理员";
  if (!email || !password) {
    throw new Error("缺少 SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD");
  }
  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        financeAccess: true,
        roles: { create: [{ role: "admin" }] },
      },
    });
    console.log("created", email);
  } else {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, status: "active", financeAccess: true },
    });
    console.log("password_reset", email);
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
