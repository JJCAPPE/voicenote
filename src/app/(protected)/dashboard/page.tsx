import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { getNoteService } from "@/server/services/factories";

import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  try {
    await requireSession();
  } catch {
    redirect("/login");
  }

  const notes = await getNoteService().list();

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Private workspace</p>
          <h1>Capture the conversation. Keep the context.</h1>
        </div>
        <p>
          Record in segments, attach source material, and retrieve the details
          later with semantic search.
        </p>
      </header>
      <DashboardClient initialNotes={notes} />
    </>
  );
}
