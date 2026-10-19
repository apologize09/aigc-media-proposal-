"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ProjectWorkspace } from "@/components/workspace/project-workspace";

type Member = {
  userId: string;
  email: string;
  name: string;
};

type Project = {
  id: string;
  title: string;
  brief: string;
  clientName: string;
  ownerUserId: string;
  ownerName: string;
  archivedAt: string | null;
  members: Member[];
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; project: Project };

export function ProjectDetail({ projectId }: { projectId: string }) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoadState({ status: "loading" });
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const payload = (await response.json()) as {
        project?: Project;
        error?: string;
      };
      if (!response.ok || !payload.project) {
        setLoadState({
          status: "error",
          message: payload.error ?? "无法加载项目",
        });
        return;
      }
      setTitle(payload.project.title);
      setBrief(payload.project.brief);
      setLoadState({ status: "ready", project: payload.project });
    } catch {
      setLoadState({ status: "error", message: "网络错误" });
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        const payload = (await response.json()) as {
          project?: Project;
          error?: string;
        };
        if (cancelled) {
          return;
        }
        if (!response.ok || !payload.project) {
          setLoadState({
            status: "error",
            message: payload.error ?? "无法加载项目",
          });
          return;
        }
        setTitle(payload.project.title);
        setBrief(payload.project.brief);
        setLoadState({ status: "ready", project: payload.project });
      } catch {
        if (!cancelled) {
          setLoadState({ status: "error", message: "网络错误" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, brief }),
      });
      const payload = (await response.json()) as {
        project?: Project;
        error?: string;
      };
      if (!response.ok || !payload.project) {
        setFormError(payload.error ?? "保存失败");
        return;
      }
      setLoadState({ status: "ready", project: payload.project });
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  }

  async function setArchived(archived: boolean) {
    setFormError(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const payload = (await response.json()) as {
        project?: Project;
        error?: string;
      };
      if (!response.ok || !payload.project) {
        setFormError(payload.error ?? "操作失败");
        return;
      }
      setLoadState({ status: "ready", project: payload.project });
    } catch {
      setFormError("网络错误");
    } finally {
      setSaving(false);
    }
  }

  async function onAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setMemberBusy(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: memberEmail }),
      });
      const payload = (await response.json()) as {
        project?: Project;
        error?: string;
      };
      if (!response.ok || !payload.project) {
        setFormError(payload.error ?? "添加失败");
        return;
      }
      setMemberEmail("");
      setLoadState({ status: "ready", project: payload.project });
    } catch {
      setFormError("网络错误");
    } finally {
      setMemberBusy(false);
    }
  }

  async function onRemoveMember(userId: string) {
    setFormError(null);
    setMemberBusy(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/members/${userId}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as {
        project?: Project;
        error?: string;
      };
      if (!response.ok || !payload.project) {
        setFormError(payload.error ?? "移除失败");
        return;
      }
      setLoadState({ status: "ready", project: payload.project });
    } catch {
      setFormError("网络错误");
    } finally {
      setMemberBusy(false);
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
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void reload()}>
            重试
          </Button>
          <Button asChild variant="outline">
            <Link href="/projects">返回列表</Link>
          </Button>
        </div>
      </div>
    );
  }

  const project = loadState.project;

  return (
    <div className="space-y-8">
      {formError ? (
        <p className="text-sm text-red-700" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-600">
            {project.clientName} · 负责人 {project.ownerName}
            {project.archivedAt ? " · 已归档" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/projects">返回列表</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => void setArchived(!project.archivedAt)}
          >
            {project.archivedAt ? "取消归档" : "归档"}
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">需求正文</h2>
        <form className="max-w-2xl space-y-3" onSubmit={onSave}>
          <input
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={saving}
            required
          />
          <textarea
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            rows={8}
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            disabled={saving}
          />
          <Button type="submit" disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">工作区</h2>
        <ProjectWorkspace projectId={projectId} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">项目成员</h2>
        <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
          {project.members.map((member) => (
            <li
              key={member.userId}
              className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"
            >
              <div>
                <p className="font-medium">
                  {member.name}{" "}
                  <span className="font-normal text-neutral-500">
                    {member.email}
                  </span>
                </p>
                {member.userId === project.ownerUserId ? (
                  <p className="text-neutral-500">负责人</p>
                ) : null}
              </div>
              {member.userId === project.ownerUserId ? null : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={memberBusy}
                  onClick={() => void onRemoveMember(member.userId)}
                >
                  移除
                </Button>
              )}
            </li>
          ))}
        </ul>
        <form className="flex max-w-xl flex-wrap gap-2" onSubmit={onAddMember}>
          <input
            className="min-w-[16rem] flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
            type="email"
            required
            placeholder="成员邮箱"
            value={memberEmail}
            onChange={(event) => setMemberEmail(event.target.value)}
            disabled={memberBusy}
          />
          <Button type="submit" disabled={memberBusy}>
            {memberBusy ? "处理中…" : "添加成员"}
          </Button>
        </form>
      </section>
    </div>
  );
}
