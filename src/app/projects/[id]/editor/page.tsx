import { ProposalEditorLoader } from "@/components/proposal-editor-loader";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProposalEditorPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">提案编辑器</h1>
      <ProposalEditorLoader projectId={id} />
    </section>
  );
}
