
export type WorkspaceFileFormat = "text" | "base64";

export interface WorkspaceFileMetadata {
  readonly name: string;
  readonly path: string;
  readonly type: string;
  readonly size: number | null;
  readonly mimetype: string | null;
  readonly last_modified: string | null;
  readonly writable: boolean | null;
}
