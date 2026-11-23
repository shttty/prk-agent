import type { MemoryContext, MemoryOperation, DocumentEdit, MemoryChange } from "../memory-types.ts";
import type { LayerSettings, LayerSpec } from "../layers/layer-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { document as locate } from "../documents/resolve-document-path.ts";
import { readRaw } from "../documents/read-document.ts";
import { entries as parseEntries } from "../documents/parse-entries.ts";
import { usage as measureUsage } from "../capacity/measure-usage.ts";
import { number } from "../capacity/format-count.ts";

type Planned = DocumentEdit & { layer: LayerSpec };

export function plan(settings: LayerSettings, operations: MemoryOperation[], context: MemoryContext): { documents: Planned[]; changes: MemoryChange[] } {
  const documents = new Map<string, Planned>();
  const changes: MemoryChange[] = [];
  for (const operation of operations) {
    let document = documents.get(operation.target);
    if (!document) {
      const { layer, path } = locate(settings, operation.target, context);
      if (context.source === "review" && !layer.review) {
        throw new WireError("INVALID_REQUEST", `Background review may not write "${layer.name}". Writable: ${settings.layers.filter((item) => item.review).map((item) => item.name).join(", ")}. No operations were applied.`);
      }
      const raw = readRaw(path);
      const original = parseEntries(raw);
      document = { target: operation.target, layer, path, raw, original, entries: [...original] };
      documents.set(operation.target, document);
    }
    const { entries } = document;
    const scoped = measureUsage(document.layer, [], context);
    const change: MemoryChange = { target: operation.target, ...(scoped.instance === undefined ? {} : { instance: scoped.instance }), ...(scoped.project === undefined ? {} : { project: scoped.project }), action: operation.action };
    if (operation.action === "add") {
      if (entries.includes(operation.content)) {
        throw new WireError("INVALID_REQUEST", `Entry already exists in ${operation.target}. No operations were applied. Current entries: ${JSON.stringify(document.original)}`, { target: operation.target, current_entries: document.original });
      }
      entries.push(operation.content);
      change.after = operation.content;
    } else {
      const matches = entries.flatMap((entry, index) => entry.includes(operation.old_text) ? [index] : []);
      if (matches.length !== 1) {
        const candidates = matches.length ? matches.map((index) => entries[index]!) : [...entries];
        throw new WireError("INVALID_REQUEST", `${matches.length ? "Ambiguous old_text: multiple entries match" : "No entry matches old_text"} in ${operation.target}. Use a unique exact substring. No operations were applied. Candidates: ${JSON.stringify(candidates)}. Current entries: ${JSON.stringify(document.original)}`, { target: operation.target, candidates, current_entries: document.original });
      }
      const index = matches[0]!;
      change.before = entries[index]!;
      if (operation.action === "remove") entries.splice(index, 1);
      else { entries[index] = operation.content; change.after = operation.content; }
    }
    changes.push(change);
  }
  for (const document of documents.values()) {
    const usage = measureUsage(document.layer, document.entries, context);
    if (usage.overLimit && !usage.soft) {
      throw new WireError("INVALID_REQUEST", `${document.target} would use ${number(usage.chars)}/${number(usage.limit)} chars, exceeding its hard limit. No operations were applied. Retry as ONE operations batch that removes or shortens old entries and adds the new entries; only the final capacity is checked. Current entries: ${JSON.stringify(document.original)}`, { ...usage, current_entries: document.original });
    }
  }
  return { documents: [...documents.values()], changes };
}
