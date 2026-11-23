const KNOWN = { control: "规矩", user: "用户", memory: "记忆", instance: "实例", project: "项目" };

/** Display name of a configured layer: the usual layers keep their Chinese names, others show the configured name. */
export const layerLabel = (name) => KNOWN[name] ?? name;
