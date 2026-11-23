import { SettingsManager } from "@earendil-works/pi-coding-agent";

export function readProjectSettings(request) {
  return SettingsManager.fromStorage({
    withLock(scope, callback) { callback(scope === "project" ? request.settings ?? undefined : undefined); },
  }, { projectTrusted: request.projectTrusted });
}
