import { getPath } from "./get-path.js";
import { Control } from "./Control.jsx";
import { setPath } from "./set-path.js";
import "./config.css";
export function ConfigFields({ sections, values, draft, onDraft, keyLabels = false }) {
  return sections.map((section, index) => <section key={`${section.title}:${index}`} className="config-card" data-config-section={section.title}>
    {section.title ? <h4 className={`config-card-head${keyLabels ? " is-key" : ""}`}>{section.title}</h4> : null}
    {section.fields.map((field) => {
      const changed = JSON.stringify(getPath(values, field.key)) !== JSON.stringify(getPath(draft, field.key));
      return <div key={field.key} className="config-field" data-config-field={field.key} data-type={field.type} data-changed={String(changed)} data-layout={field.type === "list" ? "column" : "row"}>
        <div className="config-label">
          {keyLabels ? <span className="config-key is-primary">{field.key.split(".").pop()}</span> : <><b>{field.label}</b><span className="config-key">{field.key}</span></>}
          {field.description ? <span className="config-description">{field.description}</span> : null}
        </div>
        <div className="config-control"><Control field={field} value={getPath(draft, field.key)} onChange={(value) => onDraft(setPath(draft, field.key, value))} /></div>
      </div>;
    })}
  </section>);
}
