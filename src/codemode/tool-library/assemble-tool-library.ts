import { join } from "node:path";
import { DEFAULT_TOOLS_OPTIONS, type ToolsOptions } from "../../config/tools/tools-options.ts";
import type { ToolLibraryContext } from "./library-state.ts";
import type { ToolSource, ToolLibraryEntry, ToolLibraryAction, Availability } from "./library-types.ts";
import { initializeLibrary } from "./persistence/initialize-library.ts";
import { age } from "./curation/age-library.ts";
import { list } from "./catalog/list-tools.ts";
import { active } from "./catalog/read-active-tool.ts";
import { save } from "./persistence/save-tool.ts";
import { used } from "./curation/record-use.ts";
import { change } from "./curation/change-tool.ts";
import { report } from "./curation/report-availability.ts";
import { subscribe } from "./observation/subscribe-library.ts";

/** One Gateway owns this bounded global catalog. All mutations publish before notifying runtimes. */
export class ToolLibrary {
  private readonly ctx: ToolLibraryContext;
  readonly directory: string;
  readonly options: ToolsOptions;

  constructor(home: string, options: ToolsOptions = DEFAULT_TOOLS_OPTIONS, now: () => number = Date.now) {
    this.options = options;
    this.directory = join(home, "tools");
    this.ctx = { options, now, directory: this.directory, file: join(this.directory, "library.json"), records: [], listeners: new Set(), availability: new Map() };
    initializeLibrary(this.ctx);
  }

  age(): void { age(this.ctx); }
  list(target?: string): ToolLibraryEntry[] { return list(this.ctx, target); }
  active(name: string): ToolLibraryEntry { return active(this.ctx, name); }
  save(source: ToolSource): ToolLibraryEntry { return save(this.ctx, source); }
  used(name: string, version: number, sessionId: string): void { used(this.ctx, name, version, sessionId); }
  change(action: ToolLibraryAction, name: string): ToolLibraryEntry[] { return change(this.ctx, action, name); }
  report(target: string, results: Availability[]): void { report(this.ctx, target, results); }
  subscribe(listener: () => void): () => void { return subscribe(this.ctx, listener); }
}
