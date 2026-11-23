import type { Static } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { readSchema, editSchema, writeSchema } from "./file-schema.ts";
import type { TargetLease } from "../../target-channel/lease/lease-types.ts";
export type FileOperation = "read" | "edit" | "write";

export interface FilesContext { readonly lease: () => TargetLease; readonly cwd: string }

export type ReadArguments = Static<typeof readSchema>;
export type EditArguments = Static<typeof editSchema>;
export type WriteArguments = Static<typeof writeSchema>;
export type CallTheme = Parameters<NonNullable<ToolDefinition["renderCall"]>>[1];
