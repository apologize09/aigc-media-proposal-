"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type ClientOption = { id: string; name: string };

type ProjectRow = {
  id: string;
  title: string;
  clientName: string;
  ownerName: string;
  archivedAt: string | null;
  updatedAt: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; projects: ProjectRow[]; clients: ClientOption[] };

export function ProjectsPanel() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [includeArchived, setIncludeArchived] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");

  const reload = useCallback(async () => {
    setLoadState({ status: "loading" });
    try {
      const query = includeArchived ? "?includeArchived=true" : "";
      const [projectsRes, clientsRes] = await Promise.all([
        fetch(`/api/projects${query}`),
        fetch("/api/clients"),
      ]);
      const projectsPayload = (await projectsRes.json()) as {
        projects?: ProjectRow[];
        error?: string;
      };
      const clientsPayload = (await clientsRes.json()) as {
        clients?: ClientOption[];
        error?: string;
      };

      if (!projectsRes.ok) {
        setLoadState({
          status: "error",
          message: projectsPayload.error ?? "无法加载项目",
        });
        return;
      }
      if (!clientsRes.ok) {
        setLoadState({
          status: "error",
          message: clientsPayload.error ?? "无法加载客户",
        });
        return;
      }

      const clients = clientsPayload.clients ?? [];
      setLoadState({
        status: "ready",
        projects: projectsPayload.projects ?? [],
        clients,
      });
      setClientId((current) => current || clients[0]?.id || "");
    } catch {
      setLoadState({ status: "error", message: "网络错误" });
    }
  }, [includeArchived]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const query = includeArchived ? "?includeArchived=true" : "";
        const [projectsRes, clientsRes] = await Promise.all([
          fetch(`/api/projects${query}`),
          fetch("/api/clients"),
        ]);
        const projectsPayload = (await projectsRes.json()) as {
          projects?: ProjectRow[];
          error?: string;
        };
        const clientsPayload = (await clientsRes.json()) as {
          clients?: ClientOption[];
          error?: string;
        };
        if (cancelled) {
          return;
        }
        if (!projectsRes.ok) {
          setLoadState({
            status: "error",
            message: projectsPayload.error ?? "无法加载项目",
          });
          return;
        }
        if (!clientsRes.ok) {
          setLoadState({
            status: "error",
            message: clientsPayload.error ?? "无法加载客户",
          });
          return;
        }
        const clients = clientsPayload.clients ?? [];
        setLoadState({
          status: "ready",
          projects: projectsPayload.projects ?? [],
          clients,
        });
        setClientId((current) => current || clients[0]?.id || "");
      } catch {
        if (!cancelled) {
          setLoadState({ status: "error", message: "网络错误" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [includeArchived]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, title, brief }),
      });
      const payload = (await response.json()) as {
        project?: { id: string };
        error?: string;
      };
      if (!response.ok) {
        setFormError(payload.error ?? "创建失败");
        return;
      }
      setTitle("");
      setBrief("");
      await reload();
    } catch {
      setFormError("网络错误");
    } finally {
      setCreating(false);
    }
  }

  if (loadState.status === "loading") {
    return <p className="text-sm text-neutral-600">正在加载项目…</p>;
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
        <h2 className="text-lg font-medium">新建项目</h2>
        {loadState.clients.length === 0 ? (
          <p className="text-sm text-neutral-600">
            请先到「客户」页创建客户档案，再创建项目。
          </p>
        ) : (
          <form className="max-w-xl space-y-3" onSubmit={onCreate}>
            <select
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              required
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              disabled={creating}
            >
              {loadState.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <input
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="项目标题"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={creating}
            />
            <textarea
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="需求正文"
              rows={4}
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              disabled={creating}
            />
            <Button type="submit" disabled={creating}>
              {creating ? "创建中…" : "创建项目"}
            </Button>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">项目列表</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
            />
            显示已归档
          </label>
        </div>
        {loadState.projects.length === 0 ? (
          <p className="text-sm text-neutral-600">还没有可见项目。</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
            {loadState.projects.map((project) => (
              <li
                key={project.id}
                className="flex items-center justify-between gap-3 p-4 text-sm"
              >
                <div>
                  <Link
                    href={`/projects/${project.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {project.title}
                  </Link>
                  <p className="text-neutral-600">
                    {project.clientName} · 负责人 {project.ownerName}
                    {project.archivedAt ? " · 已归档" : ""}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href={`/projects/${project.id}`}>打开</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
