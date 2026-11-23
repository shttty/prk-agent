import { createSessionSettings } from "../../session-settings/create-settings.ts";

export function projectTrusted(settingsManager: ReturnType<typeof createSessionSettings>): boolean { return settingsManager.isProjectTrusted(); }
