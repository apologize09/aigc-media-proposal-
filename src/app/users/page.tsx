import { UsersAdmin } from "@/components/users-admin";

export default function UsersPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">账号管理</h1>
      <p className="max-w-2xl text-sm leading-6 text-neutral-600">
        仅管理员可开通账号、调整职责与财务可见，并停用账号。停用后旧会话立即失效。
      </p>
      <UsersAdmin />
    </section>
  );
}
