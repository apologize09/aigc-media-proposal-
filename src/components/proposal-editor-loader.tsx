"use client";

import dynamic from "next/dynamic";

const ProposalEditor = dynamic(
  () =>
    import("@/components/proposal-editor").then((mod) => mod.ProposalEditor),
  {
    ssr: false,
    loading: () => <p className="text-sm text-neutral-600">正在加载编辑器…</p>,
  },
);

export function ProposalEditorLoader({ projectId }: { projectId: string }) {
  return <ProposalEditor projectId={projectId} />;
}
