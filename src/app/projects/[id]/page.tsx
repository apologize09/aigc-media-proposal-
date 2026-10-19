import { ProjectDetail } from "@/components/project-detail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">项目详情</h1>
      <ProjectDetail projectId={id} />
    </section>
  );
}
