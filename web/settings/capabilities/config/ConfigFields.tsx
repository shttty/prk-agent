import type { ConfigSection, ConfigValues } from "../capability-types.ts";
import { getPath } from "./get-path.ts";
import { Control } from "./Control.tsx";
import { setPath } from "./set-path.ts";
import "./config.css";
type ConfigFieldsProps = { sections: ConfigSection[]; values: ConfigValues; draft: ConfigValues; onDraft: (next: ConfigValues) => void; keyLabels?: boolean };

export function ConfigFields({ sections, values, draft, onDraft, keyLabels = false }: ConfigFieldsProps) {
  return <>{sections.map((section, index) => <section key={`${section.title}:${index}`} className="config-card" data-config-section={section.title}>
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
  </section>)}</>;
}
