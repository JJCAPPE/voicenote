import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { logoutAction } from "@/features/auth/auth.actions";
import { requireSession } from "@/lib/auth/session";

async function ensureSession() {
  try {
    await requireSession();
  } catch {
    redirect("/login");
  }
}

function NavigationLinks() {
  return (
    <>
      <Link href="/dashboard">Notes</Link>
      <Link href="/search">Search</Link>
    </>
  );
}

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  await ensureSession();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="brand" href="/dashboard">
          VoiceNote
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <NavigationLinks />
          <form action={logoutAction}>
            <button className="button-link" type="submit">
              Log out
            </button>
          </form>
        </nav>
        <details className="mobile-nav">
          <summary>Menu</summary>
          <nav aria-label="Mobile navigation">
            <NavigationLinks />
            <form action={logoutAction}>
              <button className="button-link" type="submit">
                Log out
              </button>
            </form>
          </nav>
        </details>
      </header>
      <main className="page-shell">{children}</main>
    </div>
  );
}
