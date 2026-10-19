"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type Role = "admin" | "editor" | "reviewer";

type UserRow = {
  id: string;
  email: string;
  name: string;
  status: "active" | "disabled";
  financeAccess: boolean;
  roles: Role[];
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; users: UserRow[] };

const ROLE_OPTIONS: Role[] = ["admin", "editor", "reviewer"];

export function UsersAdmin() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<Role[]>(["editor"]);
  const [financeAccess, setFinanceAccess] = useState(false);

  const reload = useCallback(async () => {
    setLoadState({ status: "loading" });
    try {
      const response = await fetch("/api/users");
      const payload = (await response.json()) as {
        users?: UserRow[];
        error?: string;
      };
      if (!response.ok) {
        setLoadState({
          status: "error",
          message: payload.error ?? "无法加载用户",
        });
        return;
      }
      setLoadState({ status: "ready", users: payload.users ?? [] });
    } catch {
      setLoadState({ status: "error", message: "网络错误" });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/users");
        const payload = (await response.json()) as {
          users?: UserRow[];
          error?: string;
        };
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setLoadState({
            status: "error",
            message: payload.error ?? "无法加载用户",
          });
          return;
        }
        setLoadState({ status: "ready", users: payload.users ?? [] });
      } catch {
        if (!cancelled) {
          setLoadState({ status: "error", message: "网络错误" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleRole(role: Role) {
    setRoles((current) =>
      current.includes(role)
        ? current.filter((item) => item !== role)
        : [...current, role],
    );
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          password,
          roles,
          financeAccess,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFormError(payload.error ?? "开通失败");
        return;
      }
      setEmail("");
      setName("");
      setPassword("");
      setRoles(["editor"]);
      setFinanceAccess(false);
      await reload();
    } catch {
      setFormError("网络错误");
    } finally {
      setCreating(false);
    }
  }

  async function patchUser(
    userId: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    setBusyId(userId);
    setFormError(null);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFormError(payload.error ?? "更新失败");
        return;
      }
      await reload();
    } catch {
      setFormError("网络错误");
    } finally {
      setBusyId(null);
    }
  }

  if (loadState.status === "loading") {
    return <p className="text-sm text-neutral-600">正在加载账号…</p>;
  }

  if (loadState.status === "error") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700" role="alert">
          {loadState.message}
        </p>
        <Button type="button" variant="outline" onClick={() => void reload()}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {formError ? (
        <p className="text-sm text-red-700" role="alert">
          {formError}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">开通账号</h2>
        <form className="max-w-xl space-y-3" onSubmit={onCreate}>
          <input
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder="邮箱"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={creating}
          />
          <input
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder="显示名"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={creating}
          />
          <input
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder="初始口令（至少 10 个字符）"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={creating}
          />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">职责</legend>
            <div className="flex flex-wrap gap-3 text-sm">
              {ROLE_OPTIONS.map((role) => (
                <label key={role} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    disabled={creating}
                  />
                  {role}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={financeAccess}
              onChange={(event) => setFinanceAccess(event.target.checked)}
              disabled={creating}
            />
            财务可见
          </label>
          <Button type="submit" disabled={creating || roles.length === 0}>
            {creating ? "开通中…" : "开通"}
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">账号列表</h2>
        {loadState.users.length === 0 ? (
          <p className="text-sm text-neutral-600">还没有账号。</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
            {loadState.users.map((user) => (
              <li key={user.id} className="space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {user.name}{" "}
                      <span className="font-normal text-neutral-500">
                        {user.email}
                      </span>
                    </p>
                    <p className="text-neutral-600">
                      {user.roles.join("、")} ·{" "}
                      {user.financeAccess ? "财务可见" : "无财务可见"} ·{" "}
                      {user.status === "active" ? "启用" : "已停用"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busyId === user.id}
                      onClick={() =>
                        void patchUser(user.id, {
                          financeAccess: !user.financeAccess,
                        })
                      }
                    >
                      {user.financeAccess ? "关闭财务可见" : "打开财务可见"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busyId === user.id}
                      onClick={() =>
                        void patchUser(user.id, {
                          status:
                            user.status === "active" ? "disabled" : "active",
                        })
                      }
                    >
                      {user.status === "active" ? "停用" : "启用"}
                    </Button>
                  </div>
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-xs font-medium text-neutral-600">
                    调整职责
                  </legend>
                  <div className="flex flex-wrap gap-3">
                    {ROLE_OPTIONS.map((role) => (
                      <label key={role} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={user.roles.includes(role)}
                          disabled={busyId === user.id}
                          onChange={() => {
                            const next = user.roles.includes(role)
                              ? user.roles.filter((item) => item !== role)
                              : [...user.roles, role];
                            if (next.length === 0) {
                              setFormError("至少保留一种职责");
                              return;
                            }
                            void patchUser(user.id, { roles: next });
                          }}
                        />
                        {role}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
