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
      <header className="library-heading">
        <p className="utility-label">Private workspace</p>
        <h1>Your notes</h1>
        <p>Record first. VoiceNote organizes the context after.</p>
      </header>
      <DashboardClient initialNotes={notes} />
    </>
  );
}
