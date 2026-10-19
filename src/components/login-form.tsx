"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { safeInternalPath } from "@/lib/safe-path";

type LoginState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<LoginState>({ status: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setState({
          status: "error",
          message: payload.error ?? "登录失败",
        });
        return;
      }

      router.replace(safeInternalPath(searchParams.get("next")));
      router.refresh();
    } catch {
      setState({ status: "error", message: "网络错误，请稍后重试" });
    }
  }

  return (
    <form className="max-w-md space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="email">
          邮箱
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          disabled={state.status === "loading"}
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="password">
          口令
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          disabled={state.status === "loading"}
        />
      </div>
      {state.status === "error" ? (
        <p className="text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={state.status === "loading"}>
        {state.status === "loading" ? "登录中…" : "登录"}
      </Button>
    </form>
  );
}
