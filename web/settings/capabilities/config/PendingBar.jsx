import { changedKeys } from "./changed-keys.js";
import { shown } from "./shown.js";
import { getPath } from "./get-path.js";
import { Button } from "@mantine/core";
export function PendingBar({ fields, values, draft, file, busy, onWrite, onReset }) {
  const keys = changedKeys(fields, values, draft);
  if (!keys.length) return null;
  const byKey = new Map(fields.map((field) => [field.key, field]));
  return <div className="config-pending" id="config-pending" data-count={keys.length}>
    <div className="config-pending-text">
      <b>{keys.length} 处改动</b> 将写入 <code>{file}</code>
      <div className="config-pending-list">{keys.slice(0, 4).map((key) => <div key={key} data-pending-key={key}>{key}: <s>{shown(byKey.get(key), getPath(values, key))}</s> → {shown(byKey.get(key), getPath(draft, key))}</div>)}
        {keys.length > 4 ? <div>另 {keys.length - 4} 处</div> : null}</div>
    </div>
    <div className="config-pending-actions">
      <Button size="xs" variant="default" data-action="config-reset" disabled={busy} onClick={onReset}>还原</Button>
      <Button size="xs" data-action="config-write" loading={busy} onClick={() => void onWrite(keys)}>写入</Button>
    </div>
  </div>;
}
