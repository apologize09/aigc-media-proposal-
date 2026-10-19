import { ClientsPanel } from "@/components/clients-panel";

export default function ClientsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">客户</h1>
      <p className="max-w-2xl text-sm leading-6 text-neutral-600">
        建立客户或品牌档案，供项目引用。联系人字段可空。内部备注不会进入客户交付页。
      </p>
      <ClientsPanel />
    </section>
  );
}
