/**
 * Host switches only. Layers, capacities and review thresholds live in `<directory>/localmemory.toml`, shared with
 * other hosts that point at the same directory.
 */
export interface MemoryOptions {
  readonly enabled: boolean;
  /** Memories directory: absolute, `~/…`, or relative to the PRK home. The default keeps memory inside the PRK home;
   *  set "~/memories" to share files with pi-local-memory on OMP/Pi. */
  readonly directory: string;
  /** Whether this gateway runs background reviews at all (thresholds come from the TOML). */
  readonly review: boolean;
}

export const DEFAULT_MEMORY_OPTIONS: MemoryOptions = Object.freeze({ enabled: true, directory: "memories", review: true });
