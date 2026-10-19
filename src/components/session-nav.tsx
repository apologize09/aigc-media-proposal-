"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type MeUser = {
  name: string;
  roles: string[];
};

export function SessionNav() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) {
          if (!cancelled) {
            setUser(null);
          }
          return;
        }
        const payload = (await response.json()) as { user: MeUser };
        if (!cancelled) {
          setUser(payload.user);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return <span className="text-sm text-neutral-500">会话检查中…</span>;
  }

  if (!user) {
    return (
      <nav className="flex gap-4 text-sm">
        <Link href="/login">登录</Link>
      </nav>
    );
  }

  const isAdmin = user.roles.includes("admin");

  return (
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/">概览</Link>
      <Link href="/clients">客户</Link>
      <Link href="/projects">项目</Link>
      {isAdmin ? <Link href="/users">账号</Link> : null}
      <span className="text-neutral-500">{user.name}</span>
      <Button type="button" variant="outline" onClick={() => void onLogout()}>
        退出
      </Button>
    </nav>
  );
}
