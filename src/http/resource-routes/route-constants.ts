import type { CodeModeMethod } from "../gateway-connection/client-types.ts";

export const kernelMethods: Record<string, CodeModeMethod> = { clear: "kernelClear", restart: "kernelRestart", variables: "kernelVariables", "variables/delete": "kernelDeleteVariable" };
export const toolMethods: Record<string, CodeModeMethod> = { promote: "toolsPromote", demote: "toolsDemote", archive: "toolsArchive", restore: "toolsRestore", delete: "toolsDelete" };
export const skillMethods: Record<string, CodeModeMethod> = { promote: "skillsPromote", demote: "skillsDemote", archive: "skillsArchive", restore: "skillsRestore", delete: "skillsDelete", scope: "skillsScope" };
export const monitorMethods: Record<string, CodeModeMethod> = { focus: "monitorFocus", history: "monitorHistory", diff: "monitorDiff" };
