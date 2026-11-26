import { AnsiText } from "../ansi/AnsiText.tsx";
/** `setStatus` entries, shown in the row under the composer. */
export function ExtensionStatus({ entries }: { entries: readonly { key: string; text: string }[] | undefined }) {
  return (entries || []).map((entry) => <span className="extension-ui-status" key={entry.key} data-status-key={entry.key}><AnsiText text={entry.text} /></span>);
}
