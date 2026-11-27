import { workspaceMethods } from "../../../workspace/requests/requests-constants.ts";

export const methods = [
 "modelCatalog",
  "capabilitiesList", "capabilitiesRefresh", "capabilitiesChange",
  "derivationGet", "derivationSet",
  "kernelExecutionGet", "kernelExecutionSet",
  "toolTitleGet", "toolTitleSet",
  "soulGet", "soulSave",
  "metricsGet", "metricsSet",
  "sessionControl", "setSessionRoot", "setProjectSupervisor",
  "pluginsList", "pluginsChange", "pluginsInstall", "pluginsUninstall",
  "artifactsList", "artifactsUpload", "artifactsCurrent", "artifactsDelete",
  "kernelVariables", "kernelDeleteVariable", "kernelInterrupt", "kernelResult",
  "toolsList", "toolsPromote", "toolsDemote", "toolsArchive", "toolsRestore", "toolsDelete",
  "skillsList", "skillsPromote", "skillsDemote", "skillsArchive", "skillsRestore", "skillsDelete", "skillsScope",
  "memoryList", "memoryChange", "memoryDeleteInstance", "memoryConfigGet", "memoryConfigSave",
  "themesList", "themesPreview", "themesImport", "themesDelete",
  "pluginConfigGet", "pluginConfigSet", "pluginConfigWrite",
  "archiveProjectPreview", "archiveProject", "renameProject",
  ...workspaceMethods,
  "getTargetEnvironment", "deployTargetEnvironment",
  "workbench", "createSession", "reloadTargets", "getTarget", "addTarget", "editTarget", "deleteTarget", "inspectTarget", "browseTarget", "assignProject", "history", "historyPage", "toolContent", "sessionPrompt", "sessionPromptPart", "renameSession", "archiveSession", "archivePreview", "unarchive", "purgeArchive", "recoverSession", "manageSession", "nativeCapabilities", "nativeAction", "state", "messages", "subscribe", "unsubscribe",
  "subscribeSessions", "unsubscribeSessions", "send", "sendStatus", "cancel", "reload", "closeSession", "shutdown", "wakeSession",
  "kernelClear", "kernelRestart", "monitorFocus", "monitorHistory", "monitorDiff",
] as const;
export const sessionScoped: readonly string[] = ["state", "messages", "sessionPrompt", "subscribe", "reload", "closeSession", "wakeSession", "archivePreview", "kernelClear", "kernelRestart", "kernelVariables", "monitorHistory"];
