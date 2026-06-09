import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";

import { SearchClient } from "./search-client";

export default async function SearchPage() {
  try {
    await requireSession();
  } catch {
    redirect("/login");
  }

  return (
    <>
      <header className="page-heading compact">
        <div>
          <p className="eyebrow">Global retrieval</p>
          <h1>Search your context</h1>
        </div>
        <p>
          Results can come from transcripts or extracted attachments and are
          labelled by source.
        </p>
      </header>
      <SearchClient />
    </>
  );
}
