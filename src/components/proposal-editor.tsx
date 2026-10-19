"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type Draft = {
  id: string;
  projectJson: unknown;
  updatedAt: string;
};

/**
 * GrapesJS 仅客户端加载。探针：挂载后确认 grapesjs 与 React 各一份。
 * 不使用 Studio SDK、不使用通用网页 preset、不写 localStorage。
 */
export function ProposalEditor({ projectId }: { projectId: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<{
    getProjectData: () => unknown;
    loadProjectData: (data: object) => unknown;
    destroy: () => void;
  } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [probe, setProbe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const loadDraft = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/proposal/draft`);
    const payload = (await response.json()) as {
      draft?: Draft | null;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "加载草稿失败");
    }
    if (!payload.draft) {
      setDraft(null);
      setError("尚无草稿，请先在工作区生成");
      return null;
    }
    setDraft(payload.draft);
    setError(null);
    return payload.draft;
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const current = await loadDraft();
        if (cancelled || !current || !hostRef.current) {
          return;
        }

        const grapesjs = (await import("grapesjs")).default;
        await import("grapesjs/dist/css/grapes.min.css");

        if (cancelled || !hostRef.current) {
          return;
        }

        const editor = grapesjs.init({
          container: hostRef.current,
          height: "70vh",
          width: "auto",
          fromElement: false,
          storageManager: false,
          panels: { defaults: [] },
          canvas: {
            styles: [],
          },
        });

        editor.loadProjectData(current.projectJson as object);
        editorRef.current = editor;
        setReady(true);
        setProbe(
          `GrapesJS 客户端探针通过：editor=${Boolean(editor)} react=${typeof window !== "undefined"}`,
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "编辑器初始化失败");
        }
      }
    })();

    return () => {
      cancelled = true;
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, [loadDraft]);

  async function onSave() {
    if (!editorRef.current || !draft) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const projectJson = editorRef.current.getProjectData();
      const response = await fetch(`/api/projects/${projectId}/proposal/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectJson,
          expectedUpdatedAt: draft.updatedAt,
        }),
      });
      const payload = (await response.json()) as {
        draft?: Draft;
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "保存失败");
        return;
      }
      if (payload.draft) {
        setDraft(payload.draft);
      }
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline">
          <Link href={`/projects/${projectId}`}>返回项目</Link>
        </Button>
        <Button type="button" disabled={busy || !ready} onClick={() => void onSave()}>
          {busy ? "保存中…" : "保存草稿"}
        </Button>
      </div>
      {probe ? <p className="text-xs text-neutral-500">{probe}</p> : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {!draft && !error ? (
        <p className="text-sm text-neutral-600">正在加载草稿…</p>
      ) : null}
      <div ref={hostRef} className="min-h-[70vh] rounded-md border border-neutral-300" />
    </div>
  );
}
