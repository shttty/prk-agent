import type { NestedSummary } from "../../../tool-text/nested-summary.ts";

/** `↳ web_search ×2 · fetch_content`: what a tool called while it ran (failed ones in red). */
export function NestedCalls({ calls }: { calls: NestedSummary[] }) {
  return (
    <div className="pi-nested-calls" data-count={calls.length}>
      <span aria-hidden="true">↳ </span>
      {calls.map((call, index) => (
        <span key={call.name}>
          {index ? " · " : ""}
          <span className="pi-nested-call" data-name={call.name} data-count={call.count} data-status={call.failed ? "error" : "ok"}>{call.name}{call.count > 1 ? <span className="pi-nested-count"> ×{call.count}</span> : null}</span>
        </span>
      ))}
    </div>
  );
}
