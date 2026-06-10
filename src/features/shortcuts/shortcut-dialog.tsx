"use client";

import { useMemo, useRef, useState } from "react";

import { SHORTCUTS } from "./shortcuts";

export function ShortcutDialog({
  dialogRef,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
}) {
  const [query, setQuery] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? SHORTCUTS.filter((shortcut) =>
          shortcut.label.toLowerCase().includes(normalized),
        )
      : SHORTCUTS;
  }, [query]);

  return (
    <dialog
      className="shortcut-dialog"
      ref={dialogRef}
      onClose={() => setQuery("")}
      onCancel={() => setQuery("")}
    >
      <div className="dialog-heading">
        <div>
          <p className="utility-label">Command reference</p>
          <h2>Keyboard shortcuts</h2>
        </div>
        <button
          className="icon-button"
          ref={closeButtonRef}
          type="button"
          aria-label="Close keyboard shortcuts"
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
      </div>
      <label className="shortcut-search">
        <span className="sr-only">Find a command</span>
        <input
          autoFocus
          type="search"
          placeholder="Find a command…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="shortcut-groups">
        {(["Capture", "Workspace", "Navigation"] as const).map((group) => {
          const items = filtered.filter((shortcut) => shortcut.group === group);
          if (items.length === 0) return null;
          return (
            <section key={group}>
              <h3>{group}</h3>
              <dl>
                {items.map((shortcut) => (
                  <div key={shortcut.label}>
                    <dt>{shortcut.label}</dt>
                    <dd>
                      {shortcut.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
      <p className="dialog-footnote">
        Single-key shortcuts are disabled while typing in a text field.
      </p>
    </dialog>
  );
}
