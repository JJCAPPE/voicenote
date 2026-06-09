"use client";

export default function ProtectedError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <section className="panel error-state">
      <p className="eyebrow">Request failed</p>
      <h1>The workspace could not be loaded.</h1>
      <p>Check the configured services, then retry this request.</p>
      <button type="button" onClick={reset}>
        Retry
      </button>
    </section>
  );
}
