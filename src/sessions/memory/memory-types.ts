import type { LayerScope, LayerSettings } from "./layers/layer-types.ts";
import type { LayerConfigFile, LayerConfigView } from "./layers/read-layer-config.ts";

/** A configured layer name. */
export type MemoryTarget = string;
export type MemoryOperation = { target: MemoryTarget } & (
  | { action: "add"; content: string }
  | { action: "replace"; content: string; old_text: string }
  | { action: "remove"; old_text: string }
);
/** Who writes and for which session scope; review may only write `review` layers. */
export interface MemoryContext extends LayerScope { sessionId: string; source: "model" | "review" | "human" }
export interface MemoryUsage { target: MemoryTarget; instance?: string; project?: string; chars: number; limit: number; soft: boolean; overLimit: boolean }
export interface MemoryChange { target: MemoryTarget; instance?: string; project?: string; action: MemoryOperation["action"]; before?: string; after?: string }
export interface MemoryDocument extends MemoryUsage { entries: string[]; deleted?: boolean; projectName?: string }
export interface MemoryResult { usage: MemoryUsage[]; changes: MemoryChange[]; message: string }
/** Layer as listed to operators: `scope` says which session value picks its file. */
export interface MemoryLayerInfo { name: string; description: string; capacityCharacters: number; soft: boolean; explicitOnly: boolean; review: boolean; scope: "none" | "instance" | "project" }
export interface MemoryListing { enabled: boolean; error?: string; layers: MemoryLayerInfo[]; memories: MemoryDocument[] }

export interface DocumentEdit { target: MemoryTarget; path: string; raw: string | undefined; original: string[]; entries: string[] }
export interface FileEdit { before: string | undefined; after: string | undefined }

export interface MemoryStoreContext {
  /** Shared memories directory holding localmemory.toml, its host overrides and the layer files. */
  readonly directory: string;
  /** Override name: `<agent>-localmemory-override.toml`. */
  readonly agent: string;
  readonly home: string;
  readonly enabled: boolean;
}

export interface MemoryStore {
  readonly directory: string;
  /** Current layer settings; throws when the TOML configuration is invalid. */
  settings(): LayerSettings;
  apply(request: unknown, context: MemoryContext): MemoryResult;
  /** Frozen prompt text for a session scope; "" when disabled or misconfigured. */
  render(scope: LayerScope & { projectName?: string }): string;
  list(instances: readonly string[]): MemoryListing;
  deleteInstance(instance: string): void;
  config(file: LayerConfigFile): LayerConfigView;
  saveConfig(file: LayerConfigFile, document: Record<string, unknown>, hash: string): LayerConfigView;
}
