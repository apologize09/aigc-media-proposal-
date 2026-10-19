import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">登录</h1>
      <p className="max-w-2xl text-sm leading-6 text-neutral-600">
        账号由管理员开通，使用本地口令。没有公开注册。
      </p>
      <Suspense
        fallback={<p className="text-sm text-neutral-600">加载登录表单…</p>}
      >
        <LoginForm />
      </Suspense>
    </section>
  );
}
