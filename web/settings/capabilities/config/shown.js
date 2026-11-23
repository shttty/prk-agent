import { isSecret } from "./is-secret.js";
export const shown = (field, value) => value === undefined ? "∅" : isSecret(field) && value ? "••••••" : JSON.stringify(value);
