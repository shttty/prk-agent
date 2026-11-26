const KNOWN = { control: "控制", user: "用户", memory: "笔记", instance: "实例", project: "项目" };

/** Display name of a configured layer: the usual layers keep their Chinese names, others show the configured name. */
export const layerLabel = (name) => KNOWN[name] ?? name;
