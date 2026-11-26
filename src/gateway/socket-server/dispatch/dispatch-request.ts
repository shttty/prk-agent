import type { PeerContext, Respond } from "../connection/peer-state.ts";
import { WireError } from "../../wire/create-error.ts";
import type { Request } from "../../wire/wire-types.ts";
import { workspaceMethods } from "../../../workspace/requests/requests-constants.ts";
import { dispatchTerminals } from "./dispatch-terminals.ts";
import { dispatchWorkspace } from "./dispatch-workspace.ts";
import { dispatchSubscriptions } from "./dispatch-subscriptions.ts";
import { dispatchCatalogs } from "./dispatch-catalogs.ts";
import { dispatchArtifactsPackages } from "./dispatch-artifacts-packages.ts";
import { dispatchLibraries, libraryActions, skillActions } from "./dispatch-libraries.ts";
import { dispatchInstances } from "./dispatch-instances.ts";
import { dispatchRuntime } from "./dispatch-runtime.ts";
import { dispatchHistory } from "./dispatch-history.ts";
import { dispatchSession } from "./dispatch-session.ts";
import { dispatchShutdown } from "./dispatch-shutdown.ts";
import { dispatchSessionControl } from "../../session-control/dispatch-session-control.ts";

export function dispatchRequest(ctx: PeerContext, respond: Respond, request: Request): Promise<void> {
  try {
    const { method } = request;
    if (ctx.listener.stopping) throw new WireError("BUSY", "Gateway is shutting down.");
    if (method === "sessionControl" || method === "setSessionRoot" || method === "setProjectSupervisor") {
      dispatchSessionControl(ctx, respond, request);
      return Promise.resolve();
    }
    if (method === "subscribeTerminal" || method === "unsubscribeTerminal") return dispatchTerminals(ctx, respond, request);
    if ((workspaceMethods as readonly string[]).includes(method)) return dispatchWorkspace(ctx, respond, request);
    if (method === "subscribe" || method === "unsubscribe" || method === "subscribeSessions" || method === "unsubscribeSessions") return dispatchSubscriptions(ctx, respond, request);
    if (method === "workbench" || method === "modelCatalog" || method === "reloadTargets"
      || method === "derivationGet" || method === "derivationSet"
      || method === "kernelExecutionGet" || method === "kernelExecutionSet"
      || method === "toolTitleGet" || method === "toolTitleSet" || method === "soulGet" || method === "soulSave"
      || method === "capabilitiesList" || method === "capabilitiesRefresh" || method === "capabilitiesChange") {
      return dispatchCatalogs(ctx, respond, request);
    }
    if (method === "pluginsList" || method === "pluginsChange" || method === "pluginsInstall" || method === "pluginsUninstall"
      || method === "artifactsList" || method === "artifactsUpload" || method === "artifactsCurrent" || method === "artifactsDelete") {
      return dispatchArtifactsPackages(ctx, respond, request);
    }
    if (method === "toolsList" || method === "skillsList" || method === "skillsScope"
      || method === "themesList" || method === "themesPreview" || method === "themesImport" || method === "themesDelete"
      || method === "memoryList" || method === "memoryChange" || method === "memoryDeleteInstance" || method === "memoryConfigGet" || method === "memoryConfigSave"
      || method === "pluginConfigGet" || method === "pluginConfigSet" || method === "pluginConfigWrite"
      || Object.hasOwn(libraryActions, method) || Object.hasOwn(skillActions, method)) {
      return dispatchLibraries(ctx, respond, request);
    }
    if (method === "getTarget" || method === "getTargetEnvironment" || method === "deployTargetEnvironment" || method === "addTarget" || method === "editTarget"
      || method === "inspectTarget" || method === "browseTarget" || method === "assignProject" || method === "deleteTarget") {
      return dispatchInstances(ctx, respond, request);
    }
    if (method === "createSession" || method === "wakeSession" || method === "recoverSession"
      || method === "kernelClear" || method === "kernelRestart"
      || method === "monitorFocus" || method === "monitorHistory" || method === "monitorDiff") {
      return dispatchRuntime(ctx, respond, request);
    }
    if (method === "history" || method === "historyPage" || method === "toolContent" || method === "kernelResult" || method === "renameSession"
      || method === "archiveSession" || method === "archivePreview" || method === "archiveProject" || method === "archiveProjectPreview" || method === "renameProject" || method === "unarchive"
      || method === "purgeArchive" || method === "manageSession") {
      return dispatchHistory(ctx, respond, request);
    }
    if (method === "nativeCapabilities" || method === "nativeAction" || method === "kernelVariables"
      || method === "kernelDeleteVariable" || method === "kernelInterrupt" || method === "state" || method === "messages"
      || method === "send" || method === "sendStatus" || method === "cancel" || method === "reload" || method === "closeSession") {
      return dispatchSession(ctx, respond, request);
    }
    if (method === "shutdown") return dispatchShutdown(ctx, respond, request);
    return Promise.resolve();
  } catch (error) { return Promise.reject(error); }
}
