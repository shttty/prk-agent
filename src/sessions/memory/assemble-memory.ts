import { homedir } from "node:os";
import type { MemoryStoreContext, MemoryContext, MemoryListing, MemoryResult } from "./memory-types.ts";
import type { LayerScope, LayerSettings } from "./layers/layer-types.ts";
import { readStoreSettings } from "./layers/read-store-settings.ts";
import { apply } from "./batches/apply-operations.ts";
import { render } from "./documents/render-snapshot.ts";
import { list } from "./documents/list-documents.ts";
import { deleteInstance } from "./documents/delete-instance.ts";
import { readLayerConfig, type LayerConfigFile, type LayerConfigView } from "./layers/read-layer-config.ts";
import { saveLayerConfig } from "./layers/save-layer-config.ts";
import { renameProjectRecord } from "./projects/rename-project-record.ts";
import { ensureProjectRecord } from "./projects/ensure-project-record.ts";

/** PRK's name for `<agent>-localmemory-override.toml` and the other shared overrides in the memories directory. */
export const MEMORY_AGENT = "prk";

/**
 * Files in the memories directory, laid out by `localmemory.toml`. Settings are re-read on every call, so
 * configuration edits reach the next session; callers own their frozen render snapshot.
 */
export class MemoryStore {
  private readonly ctx: MemoryStoreContext;

  /** `directory` is already resolved; `~/` in layer paths expands against the user's home. */
  constructor(input: { directory: string; enabled: boolean }) {
    this.ctx = { directory: input.directory, agent: MEMORY_AGENT, home: homedir(), enabled: input.enabled };
  }

  get directory(): string { return this.ctx.directory; }
  get enabled(): boolean { return this.ctx.enabled; }
  settings(): LayerSettings { return readStoreSettings(this.ctx); }
  apply(request: unknown, context: MemoryContext): MemoryResult { return apply(this.ctx, request, context); }
  render(scope: LayerScope & { projectName?: string }): string { return render(this.ctx, scope); }
  registerProject(id: string, name: string, created: string): string | undefined { return ensureProjectRecord(this.settings().projectsDirectory, id, name, created); }
  renameProject(id: string, name: string): void { renameProjectRecord(this.settings().projectsDirectory, id, name); }
  list(instances: readonly string[]): MemoryListing { return list(this.ctx, instances); }
  deleteInstance(instance: string): void { deleteInstance(this.ctx, instance); }
  config(file: LayerConfigFile): LayerConfigView { return readLayerConfig(this.ctx, file); }
  saveConfig(file: LayerConfigFile, document: Record<string, unknown>, hash: string): LayerConfigView { return saveLayerConfig(this.ctx, file, document, hash); }
}
