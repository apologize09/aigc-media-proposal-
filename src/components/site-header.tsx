import Link from "next/link";

import { SessionNav } from "@/components/session-nav";

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-medium">
          AIGC 提案系统
        </Link>
        <SessionNav />
      </div>
    </header>
  );
}
