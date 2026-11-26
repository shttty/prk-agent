import type { ConfigField } from "../capability-types.ts";
import { isSecret } from "./is-secret.ts";
export const shown = (field: ConfigField | undefined, value: unknown) => value === undefined ? "∅" : field && isSecret(field) && value ? "••••••" : JSON.stringify(value);
