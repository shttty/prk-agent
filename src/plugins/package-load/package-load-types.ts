import type { PluginLocation } from "../packages/package-types.ts";

/** An enabled settings package a session may skip; `providerIds` are the Gateway-wide providers it owns. */
export interface LoadablePackage {
  readonly source: string;
  readonly name: string;
  readonly location: PluginLocation;
  readonly providerIds: readonly string[];
}
