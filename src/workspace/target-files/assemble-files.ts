import type { FilesState, TargetFilesOptions, TargetFileContext, TargetFiles } from "./files-types.ts";
import type { WorkspaceFileFormat } from "../files/files-types.ts";
import { withOperation } from "./with-operation.ts";
import { list } from "./list.ts";
import { download } from "./download.ts";
import { read } from "./read.ts";
import { write } from "./write.ts";
import { create } from "./create.ts";
import { rename } from "./rename.ts";
import { copy } from "./copy.ts";
import { deleteFile } from "./delete.ts";
import { listCandidates } from "../target-paths/list-candidates.ts";
import { readReference } from "../target-paths/read-reference.ts";

export function assembleFiles(options: TargetFilesOptions): TargetFiles {
  const state: FilesState = { options, active: 0 };
  return {
    list: (context: TargetFileContext, path = context.cwd) => withOperation(state, context, (op) => list(op, path)),
    download: (context, path, wireChunkBytes) => download(state, context, path, wireChunkBytes),
    read: (context: TargetFileContext, path: string, format?: WorkspaceFileFormat) => withOperation(state, context, (op) => read(op, path, format)),
    write: (context: TargetFileContext, request: Parameters<typeof write>[1]) => withOperation(state, context, (op) => write(op, request)),
    create: (context: TargetFileContext, request: Parameters<typeof create>[1]) => withOperation(state, context, (op) => create(op, request)),
    rename: (context: TargetFileContext, path: string, newPath: string) => withOperation(state, context, (op) => rename(op, path, newPath)),
    copy: (context: TargetFileContext, path: string, toDir: string) => withOperation(state, context, (op) => copy(op, path, toDir)),
    delete: (context: TargetFileContext, path: string) => withOperation(state, context, (op) => deleteFile(op, path)),
    browse: (context: TargetFileContext, path: string) => withOperation(state, context, async (op) => ({ ...await list(op, path), atRoot: path === "/" })),
    referenceCandidates: (context: TargetFileContext, token = "") => withOperation(state, context, (op) => listCandidates(op, context, token)),
    readReference: (context: TargetFileContext, path: string) => withOperation(state, context, (op) => readReference(op, path)),
  };
}
