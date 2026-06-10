export type ShortcutDefinition = {
  group: "Capture" | "Workspace" | "Navigation";
  label: string;
  keys: string[];
};

export const SHORTCUTS: ShortcutDefinition[] = [
  { group: "Capture", label: "Record new note / start or stop", keys: ["R"] },
  { group: "Capture", label: "Create note with details", keys: ["N"] },
  { group: "Workspace", label: "Save active editor", keys: ["⌘/Ctrl", "S"] },
  { group: "Workspace", label: "Open Live notes", keys: ["1"] },
  { group: "Workspace", label: "Open Transcript", keys: ["2"] },
  { group: "Workspace", label: "Open AI notes", keys: ["3"] },
  { group: "Workspace", label: "Focus Ask", keys: ["A"] },
  { group: "Workspace", label: "Add attachment", keys: ["U"] },
  { group: "Workspace", label: "Submit Ask", keys: ["⌘/Ctrl", "Enter"] },
  { group: "Navigation", label: "Global search", keys: ["⌘/Ctrl", "K"] },
  { group: "Navigation", label: "Keyboard shortcuts", keys: ["⌘/Ctrl", "/"] },
  { group: "Navigation", label: "Close panel or dialog", keys: ["Esc"] },
];

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export function hasOpenDialog(): boolean {
  return document.querySelector("dialog[open]") !== null;
}

export function isModifierShortcut(
  event: KeyboardEvent,
  key: string,
): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === key;
}
