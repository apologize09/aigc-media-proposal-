import { ProjectsPanel } from "@/components/projects-panel";

export default function ProjectsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">项目</h1>
      <p className="max-w-2xl text-sm leading-6 text-neutral-600">
        非管理员只能看见自己参与的项目。管理员可见全部。归档不会自动撤销已发出的客户链接。
      </p>
      <ProjectsPanel />
    </section>
  );
}
