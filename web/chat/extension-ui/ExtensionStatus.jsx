import { AnsiText } from "../ansi/AnsiText.jsx";
/** `setStatus` entries, shown in the row under the composer. */
export function ExtensionStatus({ entries }) {
  return (entries || []).map((entry) => <span className="extension-ui-status" key={entry.key} data-status-key={entry.key}><AnsiText text={entry.text} /></span>);
}
