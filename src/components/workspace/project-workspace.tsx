"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type Tab =
  | "assets"
  | "analysis"
  | "search"
  | "pricing"
  | "tasks"
  | "proposal"
  | "audit";

type Asset = {
  id: string;
  filename: string | null;
  mime: string | null;
  origin: string;
  licenseStatus: string;
  sizeBytes: number | null;
};

type Analysis = {
  id: string;
  versionNo: number;
  confirmedAt: string | null;
  payload: {
    summary: string;
    objectives: string[];
    audience: string | null;
    deliverableNotes: string | null;
    styleNotes: string | null;
    constraints: string[];
    openQuestions: string[];
    searchQueries: string[];
  };
};

type SearchRun = {
  id: string;
  query: string;
  provider: string;
  hits: Array<{
    id: string;
    title: string | null;
    url: string;
    snippet: string | null;
    selection: string;
    assetId: string | null;
  }>;
};

type Snapshot = {
  id: string;
  versionNo: number;
  createdAt: string;
  latestReview: { decision: string; createdAt: string } | null;
};

type Task = {
  id: string;
  title: string;
  status: string;
  startOn: string | null;
  endOn: string | null;
};

type CostLine = {
  label: string;
  quantity: string;
  unitAmount: string;
  lineAmount: string;
  note: string;
};

type QuoteLine = {
  label: string;
  quantity: string;
  unitAmount: string;
  lineAmount: string;
  visibleInProposal: boolean;
};

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<Tab>("assets");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null | undefined>(
    undefined,
  );
  const [summaryDraft, setSummaryDraft] = useState("");
  const [searches, setSearches] = useState<SearchRun[] | null>(null);
  const [refUrl, setRefUrl] = useState("");
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [costLines, setCostLines] = useState<CostLine[]>([
    { label: "", quantity: "1", unitAmount: "", lineAmount: "", note: "" },
  ]);
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([
    {
      label: "",
      quantity: "1",
      unitAmount: "",
      lineAmount: "",
      visibleInProposal: true,
    },
  ]);
  const [profit, setProfit] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[] | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/assets`);
    const payload = (await response.json()) as {
      assets?: Asset[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "加载素材失败");
    }
    setAssets(payload.assets ?? []);
  }, [projectId]);

  const loadAnalysis = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/analysis`);
    const payload = (await response.json()) as {
      analysis?: Analysis | null;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "加载分析失败");
    }
    setAnalysis(payload.analysis ?? null);
    setSummaryDraft(payload.analysis?.payload.summary ?? "");
  }, [projectId]);

  const loadSearches = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/searches`);
    const payload = (await response.json()) as {
      searches?: SearchRun[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "加载搜索失败");
    }
    setSearches(payload.searches ?? []);
  }, [projectId]);

  const loadProposal = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/snapshots`);
    const payload = (await response.json()) as {
      snapshots?: Snapshot[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "加载快照失败");
    }
    setSnapshots(payload.snapshots ?? []);
  }, [projectId]);

  const loadTasks = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/tasks`);
    const payload = (await response.json()) as {
      tasks?: Task[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "加载任务失败");
    }
    setTasks(payload.tasks ?? []);
  }, [projectId]);

  const loadPricing = useCallback(async () => {
    const [costRes, quoteRes, profitRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/cost-sheet`),
      fetch(`/api/projects/${projectId}/quote-lines`),
      fetch(`/api/projects/${projectId}/profit`),
    ]);
    if (costRes.status === 403 || quoteRes.status === 403) {
      setProfit("无财务可见权限");
      setCostLines([]);
      setQuoteLines([]);
      return;
    }
    const costPayload = (await costRes.json()) as {
      costSheet?: { lines: Array<Record<string, string | null>> };
      error?: string;
    };
    const quotePayload = (await quoteRes.json()) as {
      quoteLines?: Array<Record<string, unknown>>;
      error?: string;
    };
    const profitPayload = (await profitRes.json()) as {
      profit?: { status: string };
      error?: string;
    };
    if (!costRes.ok) {
      throw new Error(costPayload.error ?? "加载成本失败");
    }
    if (!quoteRes.ok) {
      throw new Error(quotePayload.error ?? "加载报价失败");
    }
    setCostLines(
      (costPayload.costSheet?.lines ?? []).map((line) => ({
        label: String(line.label ?? ""),
        quantity: String(line.quantity ?? "1"),
        unitAmount: String(line.unitAmount ?? ""),
        lineAmount: String(line.lineAmount ?? ""),
        note: String(line.note ?? ""),
      })),
    );
    if ((costPayload.costSheet?.lines ?? []).length === 0) {
      setCostLines([
        { label: "", quantity: "1", unitAmount: "", lineAmount: "", note: "" },
      ]);
    }
    setQuoteLines(
      (quotePayload.quoteLines ?? []).map((line) => ({
        label: String(line.label ?? ""),
        quantity: String(line.quantity ?? "1"),
        unitAmount: String(line.unitAmount ?? ""),
        lineAmount: String(line.lineAmount ?? ""),
        visibleInProposal: Boolean(line.visibleInProposal),
      })),
    );
    if ((quotePayload.quoteLines ?? []).length === 0) {
      setQuoteLines([
        {
          label: "",
          quantity: "1",
          unitAmount: "",
          lineAmount: "",
          visibleInProposal: true,
        },
      ]);
    }
    setProfit(profitPayload.profit?.status ?? profitPayload.error ?? null);
  }, [projectId]);

  const loadAudit = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/audit-logs`);
    const payload = (await response.json()) as {
      logs?: AuditLog[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "加载审计失败");
    }
    setAuditLogs(payload.logs ?? []);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setError(null);
      try {
        if (tab === "assets") await loadAssets();
        if (tab === "analysis") await loadAnalysis();
        if (tab === "search") await loadSearches();
        if (tab === "proposal") await loadProposal();
        if (tab === "tasks") await loadTasks();
        if (tab === "pricing") await loadPricing();
        if (tab === "audit") await loadAudit();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    tab,
    loadAssets,
    loadAnalysis,
    loadSearches,
    loadProposal,
    loadTasks,
    loadPricing,
    loadAudit,
  ]);

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = event.currentTarget;
      const data = new FormData(form);
      const response = await fetch(`/api/projects/${projectId}/assets`, {
        method: "POST",
        body: data,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "上传失败");
        return;
      }
      form.reset();
      await loadAssets();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function runAnalysis() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/analysis`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        job?: { status: string; error?: string | null };
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "分析失败");
        return;
      }
      if (payload.job?.status === "failed") {
        setError(payload.job.error ?? "分析任务失败");
      }
      await loadAnalysis();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAnalysis() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/analysis/confirm`,
        { method: "POST" },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "确认失败");
        return;
      }
      await loadAnalysis();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function saveAnalysisSummary() {
    if (!analysis) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/analysis`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { ...analysis.payload, summary: summaryDraft },
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "保存失败");
        return;
      }
      await loadAnalysis();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function generateDraft(replace: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/proposal/draft`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(replace ? { mode: "replace" } : {}),
        },
      );
      const payload = (await response.json()) as {
        job?: { status: string; error?: string | null };
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "生成失败");
        return;
      }
      if (payload.job?.status === "failed") {
        setError(payload.job.error ?? "生成任务失败");
      }
      await loadProposal();
      await loadSearches();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/proposal/publish`,
        { method: "POST" },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "发布失败");
        return;
      }
      await loadProposal();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function reviewAndDeliver(snapshotId: string) {
    setBusy(true);
    setError(null);
    setShareUrl(null);
    try {
      await fetch(`/api/snapshots/${snapshotId}/submit`, { method: "POST" });
      const reviewRes = await fetch(`/api/snapshots/${snapshotId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approved" }),
      });
      const reviewPayload = (await reviewRes.json()) as { error?: string };
      if (!reviewRes.ok) {
        setError(reviewPayload.error ?? "审核失败");
        return;
      }
      const deliveryRes = await fetch(
        `/api/snapshots/${snapshotId}/deliveries`,
        { method: "POST" },
      );
      const deliveryPayload = (await deliveryRes.json()) as {
        delivery?: { token: string };
        error?: string;
      };
      if (!deliveryRes.ok) {
        setError(deliveryPayload.error ?? "创建链接失败");
        return;
      }
      if (deliveryPayload.delivery?.token) {
        setShareUrl(`/p/${deliveryPayload.delivery.token}`);
      }
      await loadProposal();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function addReference(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: refUrl, transfer: true }),
      });
      const payload = (await response.json()) as {
        job?: { status: string; error?: string | null };
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "补链失败");
        return;
      }
      if (payload.job?.status === "failed") {
        setError(payload.job.error ?? "转存失败");
      }
      setRefUrl("");
      await loadSearches();
      await loadAssets();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function savePricing() {
    setBusy(true);
    setError(null);
    try {
      const costRes = await fetch(`/api/projects/${projectId}/cost-sheet`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: costLines
            .filter((line) => line.label.trim())
            .map((line) => ({
              label: line.label,
              quantity: line.quantity || "1",
              unitAmount: line.unitAmount || null,
              lineAmount: line.lineAmount || null,
              note: line.note || null,
            })),
        }),
      });
      const costPayload = (await costRes.json()) as { error?: string };
      if (!costRes.ok) {
        setError(costPayload.error ?? "保存成本失败");
        return;
      }
      const quoteRes = await fetch(`/api/projects/${projectId}/quote-lines`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: quoteLines
            .filter((line) => line.label.trim())
            .map((line) => ({
              label: line.label,
              quantity: line.quantity || "1",
              unitAmount: line.unitAmount || null,
              lineAmount: line.lineAmount || null,
              visibleInProposal: line.visibleInProposal,
            })),
        }),
      });
      const quotePayload = (await quoteRes.json()) as { error?: string };
      if (!quoteRes.ok) {
        setError(quotePayload.error ?? "保存报价失败");
        return;
      }
      await loadPricing();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function createTask(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskTitle }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "创建失败");
        return;
      }
      setTaskTitle("");
      await loadTasks();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "assets", label: "素材" },
    { id: "analysis", label: "分析" },
    { id: "search", label: "搜索" },
    { id: "proposal", label: "提案" },
    { id: "pricing", label: "报价" },
    { id: "tasks", label: "任务" },
    { id: "audit", label: "审计" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={tab === item.id ? "default" : "outline"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
        <Button asChild variant="outline">
          <Link href={`/projects/${projectId}/editor`}>打开编辑器</Link>
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {tab === "assets" ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">素材</h2>
          <form className="flex flex-wrap items-end gap-2" onSubmit={onUpload}>
            <input name="file" type="file" required disabled={busy} />
            <Button type="submit" disabled={busy}>
              {busy ? "上传中…" : "上传"}
            </Button>
          </form>
          {assets === null ? (
            <p className="text-sm text-neutral-600">加载中…</p>
          ) : assets.length === 0 ? (
            <p className="text-sm text-neutral-600">暂无素材</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {assets.map((asset) => (
                <li key={asset.id} className="p-3 text-sm">
                  <p className="font-medium">
                    {asset.filename ?? asset.id}
                  </p>
                  <p className="text-neutral-500">
                    {asset.origin} · {asset.mime ?? "未知类型"} · 授权{" "}
                    {asset.licenseStatus}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "analysis" ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">需求分析</h2>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => void runAnalysis()}>
              入队分析
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !analysis || Boolean(analysis.confirmedAt)}
              onClick={() => void saveAnalysisSummary()}
            >
              保存改正
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !analysis || Boolean(analysis.confirmedAt)}
              onClick={() => void confirmAnalysis()}
            >
              确认分析
            </Button>
          </div>
          {analysis === undefined ? (
            <p className="text-sm text-neutral-600">加载中…</p>
          ) : analysis === null ? (
            <p className="text-sm text-neutral-600">尚无分析稿</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-neutral-600">
                版本 {analysis.versionNo}
                {analysis.confirmedAt
                  ? ` · 已确认 ${analysis.confirmedAt}`
                  : " · 未确认"}
              </p>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={6}
                value={summaryDraft}
                disabled={Boolean(analysis.confirmedAt) || busy}
                onChange={(event) => setSummaryDraft(event.target.value)}
              />
            </div>
          )}
        </section>
      ) : null}

      {tab === "search" ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">搜索与转存</h2>
          <form className="flex max-w-xl flex-wrap gap-2" onSubmit={addReference}>
            <input
              className="min-w-[16rem] flex-1 rounded-md border px-3 py-2 text-sm"
              placeholder="https://..."
              value={refUrl}
              onChange={(event) => setRefUrl(event.target.value)}
              required
              disabled={busy}
            />
            <Button type="submit" disabled={busy}>
              手工补链并转存
            </Button>
          </form>
          {searches === null ? (
            <p className="text-sm text-neutral-600">加载中…</p>
          ) : searches.length === 0 ? (
            <p className="text-sm text-neutral-600">尚无搜索记录</p>
          ) : (
            <ul className="space-y-3">
              {searches.map((run) => (
                <li key={run.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    {run.query}{" "}
                    <span className="font-normal text-neutral-500">
                      ({run.provider})
                    </span>
                  </p>
                  <ul className="mt-2 space-y-1">
                    {run.hits.map((hit) => (
                      <li key={hit.id}>
                        <a
                          className="text-blue-700 underline"
                          href={hit.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {hit.title ?? hit.url}
                        </a>{" "}
                        · {hit.selection}
                        {hit.assetId ? " · 已转存" : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "proposal" ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">提案与发布</h2>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => void generateDraft(false)}>
              生成草稿
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void generateDraft(true)}
            >
              替换草稿
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void publish()}>
              发布快照
            </Button>
            <Button asChild variant="outline">
              <Link href={`/projects/${projectId}/editor`}>编辑器</Link>
            </Button>
          </div>
          {shareUrl ? (
            <p className="text-sm">
              客户链接（仅显示一次令牌路径）：{" "}
              <a className="text-blue-700 underline" href={shareUrl}>
                {shareUrl}
              </a>
            </p>
          ) : null}
          {snapshots === null ? (
            <p className="text-sm text-neutral-600">加载中…</p>
          ) : snapshots.length === 0 ? (
            <p className="text-sm text-neutral-600">尚无快照</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {snapshots.map((snapshot) => (
                <li
                  key={snapshot.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">版本 {snapshot.versionNo}</p>
                    <p className="text-neutral-500">
                      {snapshot.createdAt}
                      {snapshot.latestReview
                        ? ` · ${snapshot.latestReview.decision}`
                        : " · 未审核"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void reviewAndDeliver(snapshot.id)}
                  >
                    送审并通过并交付
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "pricing" ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">成本与报价</h2>
          <p className="text-sm text-neutral-600">
            利润：{profit ?? "加载中…"}
          </p>
          {profit === "无财务可见权限" ? null : (
            <>
              <div className="space-y-2">
                <h3 className="font-medium">成本行</h3>
                {costLines.map((line, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-5">
                    <input
                      className="rounded-md border px-2 py-1 text-sm"
                      placeholder="名称"
                      value={line.label}
                      onChange={(event) => {
                        const next = [...costLines];
                        next[index] = { ...line, label: event.target.value };
                        setCostLines(next);
                      }}
                    />
                    <input
                      className="rounded-md border px-2 py-1 text-sm"
                      placeholder="数量"
                      value={line.quantity}
                      onChange={(event) => {
                        const next = [...costLines];
                        next[index] = { ...line, quantity: event.target.value };
                        setCostLines(next);
                      }}
                    />
                    <input
                      className="rounded-md border px-2 py-1 text-sm"
                      placeholder="单价"
                      value={line.unitAmount}
                      onChange={(event) => {
                        const next = [...costLines];
                        next[index] = {
                          ...line,
                          unitAmount: event.target.value,
                        };
                        setCostLines(next);
                      }}
                    />
                    <input
                      className="rounded-md border px-2 py-1 text-sm"
                      placeholder="行金额"
                      value={line.lineAmount}
                      onChange={(event) => {
                        const next = [...costLines];
                        next[index] = {
                          ...line,
                          lineAmount: event.target.value,
                        };
                        setCostLines(next);
                      }}
                    />
                    <input
                      className="rounded-md border px-2 py-1 text-sm"
                      placeholder="备注"
                      value={line.note}
                      onChange={(event) => {
                        const next = [...costLines];
                        next[index] = { ...line, note: event.target.value };
                        setCostLines(next);
                      }}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setCostLines([
                      ...costLines,
                      {
                        label: "",
                        quantity: "1",
                        unitAmount: "",
                        lineAmount: "",
                        note: "",
                      },
                    ])
                  }
                >
                  增加成本行
                </Button>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">报价行</h3>
                {quoteLines.map((line, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-5">
                    <input
                      className="rounded-md border px-2 py-1 text-sm"
                      placeholder="名称"
                      value={line.label}
                      onChange={(event) => {
                        const next = [...quoteLines];
                        next[index] = { ...line, label: event.target.value };
                        setQuoteLines(next);
                      }}
                    />
                    <input
                      className="rounded-md border px-2 py-1 text-sm"
                      placeholder="数量"
                      value={line.quantity}
                      onChange={(event) => {
                        const next = [...quoteLines];
                        next[index] = { ...line, quantity: event.target.value };
                        setQuoteLines(next);
                      }}
                    />
                    <input
                      className="rounded-md border px-2 py-1 text-sm"
                      placeholder="单价"
                      value={line.unitAmount}
                      onChange={(event) => {
                        const next = [...quoteLines];
                        next[index] = {
                          ...line,
                          unitAmount: event.target.value,
                        };
                        setQuoteLines(next);
                      }}
                    />
                    <input
                      className="rounded-md border px-2 py-1 text-sm"
                      placeholder="行金额"
                      value={line.lineAmount}
                      onChange={(event) => {
                        const next = [...quoteLines];
                        next[index] = {
                          ...line,
                          lineAmount: event.target.value,
                        };
                        setQuoteLines(next);
                      }}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={line.visibleInProposal}
                        onChange={(event) => {
                          const next = [...quoteLines];
                          next[index] = {
                            ...line,
                            visibleInProposal: event.target.checked,
                          };
                          setQuoteLines(next);
                        }}
                      />
                      对客可见
                    </label>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setQuoteLines([
                      ...quoteLines,
                      {
                        label: "",
                        quantity: "1",
                        unitAmount: "",
                        lineAmount: "",
                        visibleInProposal: true,
                      },
                    ])
                  }
                >
                  增加报价行
                </Button>
              </div>
              <Button type="button" disabled={busy} onClick={() => void savePricing()}>
                保存成本与报价
              </Button>
            </>
          )}
        </section>
      ) : null}

      {tab === "tasks" ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">执行任务</h2>
          <form className="flex max-w-xl flex-wrap gap-2" onSubmit={createTask}>
            <input
              className="min-w-[16rem] flex-1 rounded-md border px-3 py-2 text-sm"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder="任务标题"
              required
              disabled={busy}
            />
            <Button type="submit" disabled={busy}>
              新增
            </Button>
          </form>
          {tasks === null ? (
            <p className="text-sm text-neutral-600">加载中…</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-neutral-600">暂无任务</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {tasks.map((task) => (
                <li key={task.id} className="p-3 text-sm">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-neutral-500">状态 {task.status}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "audit" ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">审计</h2>
          {auditLogs === null ? (
            <p className="text-sm text-neutral-600">加载中…</p>
          ) : auditLogs.length === 0 ? (
            <p className="text-sm text-neutral-600">暂无记录</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {auditLogs.map((log) => (
                <li key={log.id} className="p-3 text-sm">
                  <p className="font-medium">{log.action}</p>
                  <p className="text-neutral-500">
                    {log.entityType}/{log.entityId} · {log.createdAt}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
