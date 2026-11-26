import type { Preset, PresetKind, PresetLeaf, PresetNode } from "./preset-types.ts";
import { isRecord } from "../../../workspace/editor-layout/is-record.ts";
import { WORK_KINDS } from "./preset-kinds.ts";

const isSize = (size: unknown) => size === null || (typeof size === "number" && Number.isFinite(size) && size >= 0);

const count = (node: PresetNode, test: (leaf: PresetLeaf) => boolean): number => (node.type === "leaf" ? (test(node) ? 1 : 0) : node.data.reduce((sum, child) => sum + count(child, test), 0));

const countChat = (node: PresetNode) => count(node, (leaf) => leaf.kinds.includes("chat"));

// The stored layout is JSON from this page's earlier runs; validNode checks every field a PresetNode promises.
function validNode(node: unknown): node is PresetNode {
  if (!isRecord(node) || !isSize(node.size)) return false;
  if (node.type === "leaf") {
    const kinds = node.kinds;
    return (node.main === undefined || node.main === true) && Array.isArray(kinds) && kinds.length > 0 && (kinds.join() === "chat" || kinds.every((kind: PresetKind) => WORK_KINDS.includes(kind)));
  }
  return node.type === "branch" && Array.isArray(node.data) && node.data.length > 0 && node.data.every(validNode);
}

/** A layout this module wrote: a split tree with exactly one chat group and at most one main area (none: the chat). */
export const validLayout = (layout: unknown): layout is Preset => isRecord(layout) && typeof layout.orientation === "string" && ["HORIZONTAL", "VERTICAL"].includes(layout.orientation) && typeof layout.workspaceOpen === "boolean"
  && isRecord(layout.root) && layout.root.type === "branch" && validNode(layout.root) && countChat(layout.root) === 1 && count(layout.root, (leaf) => leaf.main === true) <= 1;
