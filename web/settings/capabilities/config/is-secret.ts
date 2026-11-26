import type { ConfigField } from "../capability-types.ts";

// One form for every provider configuration: `sections` = [{title, fields:[{key, label, type, options?, description?,
// secret?, scale?, unit?, min?}]}], `key` a dot path into `values`. Edits stay in `draft` (owned by the caller so they
// survive closing the panel) until 写入; the pending bar lists every changed key as `key: old → new`.

export const SECRET_KEY = /key|token|secret|password/i;

export const isSecret = (field: ConfigField) => field.secret === true || SECRET_KEY.test(field.key.split(".").pop() ?? "");
