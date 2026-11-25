export interface WorkspaceOptions {
  readonly fileReadBytes: number;
  readonly fileChunkBytes: number;
  readonly directoryEntries: number;
  readonly directoryBytes: number;
  readonly directoryPageEntries: number;
  readonly fileRequestsMax: number;
  readonly terminalInputBytes: number;
  readonly terminalStartTimeoutMs: number;
  readonly terminalCloseTimeoutMs: number;
  readonly terminalReplayBytes: number;
  readonly terminalsPerWorkerMax: number;
}

export const DEFAULT_WORKSPACE_OPTIONS: WorkspaceOptions = Object.freeze({
  fileReadBytes: 512 * 1024,
  fileChunkBytes: 262144,
  directoryEntries: 1000,
  directoryBytes: 262144,
  directoryPageEntries: 32,
  fileRequestsMax: 16,
  terminalInputBytes: 1048576,
  terminalStartTimeoutMs: 10000,
  terminalCloseTimeoutMs: 3000,
  terminalReplayBytes: 256 * 1024,
  terminalsPerWorkerMax: 4,
});

export const FILE_CHUNK_BYTES_MAX = 16711680;
