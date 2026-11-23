import type { SettingsManager } from "@earendil-works/pi-coding-agent";

export const projectTrusted = (settingsManager: SettingsManager) => settingsManager.isProjectTrusted();
