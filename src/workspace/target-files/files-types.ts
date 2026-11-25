import type { NativeReferenceCandidate } from "../../sessions/native-interaction/native-types.ts";
import type { Connection, RequestOptions } from "@earendil-works/pi-env";
import type { TargetEnvironmentLease } from "../../target-environment/connection/connection-types.ts";
import type { WorkspaceOptions } from "../../config/workspace/workspace-options.ts";
import type { ReferencesOptions } from "../../config/references/references-options.ts";
import type { TargetConnectionOptions } from "../../config/target-connection/target-connection-options.ts";
import type { WorkspaceFileMetadata, WorkspaceFileFormat } from "../files/files-types.ts";

export interface TargetFileContext {
  readonly target: string;
  readonly sessionId: string;
  readonly cwd: string;
}
export interface TargetFilesOptions {
  readonly environments: { acquire(id: string): Promise<TargetEnvironmentLease> };
  readonly workspace: WorkspaceOptions;
  readonly references: ReferencesOptions;
  readonly targetConnection: TargetConnectionOptions;
}
export interface FilesState {
  readonly options: TargetFilesOptions;
  active: number;
}
export interface FileOperation {
  readonly options: TargetFilesOptions;
  readonly connection: Connection;
  readonly requestOptions: RequestOptions;
}
export type FileRead = WorkspaceFileMetadata & { content: string; format: WorkspaceFileFormat };
export type FileListing = { path: string; entries: WorkspaceFileMetadata[]; truncated: boolean };

export type DownloadMetadata = { name: string; size: number };
export type DownloadChunk = { data: string };
export type FileDownload = AsyncGenerator<DownloadMetadata | DownloadChunk, DownloadChunk | undefined, void>;

export type UploadMetadata = { chunkBytes: number };
export type FileUpload = AsyncGenerator<UploadMetadata | undefined, undefined, Buffer | undefined>;

export interface TargetFiles {
  upload(context: TargetFileContext, path: string, overwrite: boolean, wireChunkBytes: number): FileUpload;
  download(context: TargetFileContext, path: string, wireChunkBytes: number, inlineImage?: boolean): FileDownload;
  list(context: TargetFileContext, path?: string): Promise<FileListing>;
  read(context: TargetFileContext, path: string, format?: WorkspaceFileFormat): Promise<FileRead>;
  write(context: TargetFileContext, request: { path: string; content: string; format: "text"; expectedLastModified?: string }): Promise<WorkspaceFileMetadata>;
  create(context: TargetFileContext, request: { path: string; type: "file" | "directory"; content?: string; format?: "text" }): Promise<WorkspaceFileMetadata>;
  rename(context: TargetFileContext, path: string, newPath: string): Promise<WorkspaceFileMetadata>;
  copy(context: TargetFileContext, path: string, toDir: string): Promise<WorkspaceFileMetadata>;
  delete(context: TargetFileContext, path: string): Promise<{ path: string }>;
  browse(context: TargetFileContext, path: string): Promise<FileListing & { atRoot: boolean }>;
  referenceCandidates(context: TargetFileContext, token?: string): Promise<{ candidates: NativeReferenceCandidate[]; truncated: boolean }>;
  readReference(context: TargetFileContext, path: string): Promise<{ path: string; type: string; content: string }>;
}
