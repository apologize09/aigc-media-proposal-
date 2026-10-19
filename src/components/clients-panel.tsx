"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type ClientRow = {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  internalNotes: string | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; clients: ClientRow[] };

export function ClientsPanel() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const reload = useCallback(async () => {
    setLoadState({ status: "loading" });
    try {
      const response = await fetch("/api/clients");
      const payload = (await response.json()) as {
        clients?: ClientRow[];
        error?: string;
      };
      if (!response.ok) {
        setLoadState({
          status: "error",
          message: payload.error ?? "无法加载客户",
        });
        return;
      }
      setLoadState({ status: "ready", clients: payload.clients ?? [] });
    } catch {
      setLoadState({ status: "error", message: "网络错误" });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/clients");
        const payload = (await response.json()) as {
          clients?: ClientRow[];
          error?: string;
        };
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setLoadState({
            status: "error",
            message: payload.error ?? "无法加载客户",
          });
          return;
        }
        setLoadState({ status: "ready", clients: payload.clients ?? [] });
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

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          contactName,
          contactEmail,
          contactPhone,
          internalNotes,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFormError(payload.error ?? "创建失败");
        return;
      }
      setName("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setInternalNotes("");
      await reload();
    } catch {
      setFormError("网络错误");
    } finally {
      setCreating(false);
    }
  }

  if (loadState.status === "loading") {
    return <p className="text-sm text-neutral-600">正在加载客户…</p>;
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
        <h2 className="text-lg font-medium">新建客户</h2>
        <form className="max-w-xl space-y-3" onSubmit={onCreate}>
          <input
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder="客户或品牌名称"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={creating}
          />
          <input
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder="联系人（可空）"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            disabled={creating}
          />
          <input
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder="联系邮箱（可空）"
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            disabled={creating}
          />
          <input
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder="联系电话（可空）"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            disabled={creating}
          />
          <textarea
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            placeholder="内部备注（不对客户展示）"
            rows={3}
            value={internalNotes}
            onChange={(event) => setInternalNotes(event.target.value)}
            disabled={creating}
          />
          <Button type="submit" disabled={creating}>
            {creating ? "创建中…" : "创建客户"}
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">客户列表</h2>
        {loadState.clients.length === 0 ? (
          <p className="text-sm text-neutral-600">还没有客户档案。</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
            {loadState.clients.map((client) => (
              <li key={client.id} className="space-y-1 p-4 text-sm">
                <p className="font-medium">{client.name}</p>
                <p className="text-neutral-600">
                  {[
                    client.contactName,
                    client.contactEmail,
                    client.contactPhone,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "未填写联系人"}
                </p>
                {client.internalNotes ? (
                  <p className="text-neutral-500">
                    备注：{client.internalNotes}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
