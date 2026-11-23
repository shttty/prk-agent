import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { PythonToolClient } from "../../kernel/kernel-types.ts";
import type { ToolLibrary } from "../../codemode/tool-library/assemble-tool-library.ts";
import type { ToolLibraryRegistration, ToolLibraryRegistrationContext } from "./registration-types.ts";
import { metadataSchema, availabilitySchema } from "../../codemode/tool-library/library-schema.ts";
import { refresh as refreshDeclarations } from "./registration/refresh-declarations.ts";
import { unsubscribe as disposeRegistration } from "./registration/dispose-registration.ts";
import { saveToolCallback } from "./registration/save-tool-callback.ts";
import { accessLibraryCallback } from "./registration/access-library-callback.ts";
import { recordUseCallback } from "./registration/record-use-callback.ts";
import { reportAvailabilityCallback } from "./registration/report-availability-callback.ts";

/** Public extension registration, retained per SDK runtime; the only executor is its owned Python client. */
export function registerToolLibrary(pi: ExtensionAPI, library: ToolLibrary, target: string, python: () => PythonToolClient, sessionId: () => string, allowed: (name: string) => boolean = () => true): ToolLibraryRegistration {
  const ctx: ToolLibraryRegistrationContext = { pi, library, target, python, sessionId, allowed, known: new Map(), refreshing: false, refresh, subscriptions: [] };
  function refresh(): void { refreshDeclarations(ctx); }
  const outputSchema = Type.Object({}, { additionalProperties: true });
  pi.registerTool({ name: "prk_library_save", label: "Save Python tool", exposure: "codemode", outputSchema,
    description: "Persist inspected target Python source into the shared staging library.", parameters: metadataSchema,
    execute: async (_id, args) => saveToolCallback(ctx, args) });
  pi.registerTool({ name: "prk_library_access", label: "Load Python tools", exposure: "codemode", outputSchema,
    description: "Get the authoritative active tool library for this target kernel.", parameters: Type.Object({}, { additionalProperties: false }),
    execute: async () => accessLibraryCallback(ctx) });
  pi.registerTool({ name: "prk_library_used", label: "Record Python tool use", exposure: "codemode", outputSchema,
    description: "Record successful current-kernel execution against the native SDK session id.",
    parameters: Type.Object({ name: Type.String(), version: Type.Integer({ minimum: 1 }) }, { additionalProperties: false }),
    execute: async (_id, args) => recordUseCallback(ctx, args) });
  pi.registerTool({ name: "prk_library_available", label: "Report Python imports", exposure: "codemode", outputSchema,
    description: "Report actual target-kernel tool import results without persisting target failures globally.",
    parameters: Type.Object({ tools: Type.Array(availabilitySchema) }, { additionalProperties: false }),
    execute: async (_id, args) => reportAvailabilityCallback(ctx, args) });
  ctx.subscriptions = [library.subscribe(refresh), pi.on("before_agent_start", refresh), pi.on("turn_start", refresh), pi.on("tool_call", refresh)];
  const unsubscribe = (): void => { disposeRegistration(ctx); };
  pi.on("session_shutdown", unsubscribe);
  refresh();
  return { refresh, dispose: unsubscribe };
}
