// `PluginLocation` choices (docs/wire/plugin-config.md#pi-packages). New installs default to the Gateway; the session
// host is for plugins that must work on the target's files, processes or environment.
export const PLUGIN_LOCATIONS = [{ value: "gateway", label: "Gateway" }, { value: "host", label: "会话宿主" }];
export const DEFAULT_PLUGIN_LOCATION = "gateway";
