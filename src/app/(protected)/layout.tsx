import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { requireSession } from "@/lib/auth/session";

import { AppHeader } from "./app-header";

async function ensureSession() {
  try {
    await requireSession();
  } catch {
    redirect("/login");
  }
}

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  await ensureSession();

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page-shell">{children}</main>
    </div>
  );
}
