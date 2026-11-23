import { stringify } from "smol-toml";

const CONFIG_HEADER = "# PRK global settings. Written by the PRK settings form; comments are not kept.\n";
const INSTANCES_HEADER = "# PRK instance definitions. Written by the PRK settings form; comments are not kept.\n";


export function formatTomlDocument(filename: "config.toml" | "instances.toml", document: object): string {
  const header = filename === "config.toml" ? CONFIG_HEADER : INSTANCES_HEADER;
  const body = stringify(document);
  if (!body.trim()) return header;
  return `${header}\n${body}${body.endsWith("\n") ? "" : "\n"}`;
}
