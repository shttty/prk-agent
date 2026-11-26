import { basename, dirname, extname } from "node:path";
import type { Extension } from "@earendil-works/pi-coding-agent";
import { packageName } from "../resource-catalog/origins/read-resource-package-name.ts";

const labels = new WeakMap<Extension, string>();

/** Package name for packages, the name of an inline factory, else the file's name without extension: never a full path. */
export function readPluginLabel(extension: Extension): string {
  let label = labels.get(extension);
  if (label === undefined) {
    const { sourceInfo } = extension;
    label = sourceInfo.origin === "package" ? packageName(sourceInfo) : fileLabel(sourceInfo.path);
    labels.set(extension, label);
  }
  return label;
}

function fileLabel(path: string): string {
  const inline = /^<inline:(.+)>$/u.exec(path);
  if (inline) return inline[1]!;
  const name = basename(path, extname(path));
  return name === "index" ? basename(dirname(path)) : name;
}
