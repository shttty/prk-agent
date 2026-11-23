import { targetNames } from "./MemoryNotice.jsx";
import { actionNames } from "./MemoryNotice.jsx";
export function Changes({ changes }) {
  return <div className="pi-memory-changes">{changes.map((change, index) => <section key={index} data-memory-change={change.action} data-target={change.target}>
    <div className="pi-memory-change-heading">{targetNames[change.target]}{change.instance ? ` · ${change.instance}` : ""} · {actionNames[change.action]}</div>
    <div className="pi-memory-diff">
      {change.before !== undefined ? <div data-side="before"><span>改前</span><p>{change.before}</p></div> : null}
      {change.after !== undefined ? <div data-side="after"><span>{change.before === undefined ? "新增" : "改后"}</span><p>{change.after}</p></div> : null}
    </div>
  </section>)}</div>;
}
