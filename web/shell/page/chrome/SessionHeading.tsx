import type { WorkbenchState } from "../page-types.ts";
import type { ManagedSessionSnapshot, PublicExecutionTarget } from "../../../../src/gateway/wire/web-types.ts";
import { AnsiText } from "../../../chat/ansi/AnsiText.jsx";
import { useWorkbench } from "../../../workbench/subscription/use-workbench.js";

/** Desktop: which session this is, on one quiet line in the chat column's control strip (no title bar of its own):
 * name · 子会话 (derived sessions) · instance · model. Every part comes from the workbench row and the live snapshot. */
export function SessionHeading({ sessionRow }: { sessionRow: ManagedSessionSnapshot }) {
  const instance = useWorkbench((state: WorkbenchState) => state.targets.find((target: PublicExecutionTarget) => target.id === sessionRow.target)?.label) || sessionRow.target || "";
  const snapshotModel = useWorkbench((state: WorkbenchState) => state.session.snapshot?.model);
  const pluginTitle = useWorkbench((state: WorkbenchState) => state.session.extensionUi?.title);
  const model = typeof snapshotModel === "string" ? snapshotModel : "";
  const facts = [sessionRow.derivation ? "子会话" : "", instance, model].filter(Boolean);
  return <div className="pi-session-heading" id="session-heading" data-kind={sessionRow.derivation ? "child" : "session"}>
    <strong><AnsiText text={pluginTitle || sessionRow.label || sessionRow.sessionId} /></strong>
    {facts.map((fact, index) => <span key={index} className="pi-session-fact">{fact}</span>)}
  </div>;
}
