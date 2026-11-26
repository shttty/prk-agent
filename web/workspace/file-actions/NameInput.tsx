import type { Icon } from "@tabler/icons-react";
import { useRef } from "react";
import { useLayoutEffect } from "react";
type NameInputProps = { initial?: string; icon: Icon; label: string; onCommit: (name: string) => void; onCancel: () => void };

export function NameInput({ initial = "", icon: Icon, label, onCommit, onCancel }: NameInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const shownAt = useRef(0);
  // Layout effect: focus inside the tap's user activation so phones raise the keyboard.
  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    shownAt.current = performance.now();
    element.focus();
    const dot = initial.lastIndexOf(".");
    element.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);
  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    const value = input.current?.value.trim() ?? "";
    if (commit && value && value !== initial) onCommit(value);
    else onCancel();
  };
  return <div className="pi-files-row is-editing">
    <Icon size={15} stroke={1.6} aria-hidden="true" className="pi-files-icon" />
    <input ref={input} className="pi-files-input" defaultValue={initial} aria-label={label} spellCheck={false} autoCapitalize="off" autoCorrect="off" autoComplete="off"
      onKeyDown={(event) => {
        if (event.key === "Enter") { event.preventDefault(); finish(true); }
        else if (event.key === "Escape") { event.preventDefault(); finish(false); }
      }}
      onBlur={() => {
        // A closing menu/sheet can steal focus right after the input appears; take it back instead of cancelling.
        if (performance.now() - shownAt.current < 500) { setTimeout(() => input.current?.focus(), 0); return; }
        finish(true);
      }} />
  </div>;
}
