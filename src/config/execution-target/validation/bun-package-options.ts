import { isPythonIndexUrl } from "../../python-index/is-python-index-url.ts";

export interface BunRegistry {
  readonly registry: string;
  readonly scopes?: Readonly<Record<string, string>>;
}
export type BunPackagePins = Readonly<Record<string, string>>;

const names = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
const scopeName = /^@[a-z0-9][a-z0-9._-]*$/u;
const pin = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/u;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const registry = (value: unknown): value is string => typeof value === "string" && value.length <= 2048 && isPythonIndexUrl(value);

export function isBunRegistry(value: unknown): value is BunRegistry {
  return record(value) && registry(value.registry) && Object.keys(value).every((key) => key === "registry" || key === "scopes")
    && (value.scopes === undefined || record(value.scopes) && Object.keys(value.scopes).length <= 16
      && Object.entries(value.scopes).every(([scope, url]) => scope.length <= 128 && scopeName.test(scope) && registry(url)));
}

export function isBunPackagePins(value: unknown): value is BunPackagePins {
  if (!record(value)) return false;
  const entries = Object.entries(value);
  return entries.length > 0 && entries.length <= 64 && entries.every(([name, version]) => name.length <= 214 && names.test(name)
    && typeof version === "string" && version.length <= 128 && pin.test(version));
}
