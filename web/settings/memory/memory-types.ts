/** One configured memory layer as `/memory/list` returns it. */
export type MemoryLayer = { name: string; scope: string };

/** One memory file: a layer's single document, or one instance's / project's. */
export type MemoryDocumentData = { target: string; instance?: string; project?: string; entries: string[]; chars: number; limit: number; overLimit: boolean; soft?: boolean; deleted?: boolean };

export type MemoryListing = { enabled: boolean; layers: MemoryLayer[]; memories: MemoryDocumentData[]; error?: string };

/** The document scope of an edit or a deletion; `old_text` names the entry being replaced or removed. */
export type MemoryScope = { target: string; instance?: string; project?: string };
export type MemoryEditor = MemoryScope & { old_text?: string; content: string };
export type MemoryDeletion = MemoryScope & { old_text?: string };

/** A layer as written in localmemory.toml or its override. */
export type ConfigLayer = { name?: string; path?: string; description?: string; capacityCharacters?: number; soft?: boolean; explicitOnly?: boolean; review?: boolean; enabled?: boolean };
export type LayerField = keyof ConfigLayer;
export type LayerValue = string | number | boolean | undefined;

export type ReviewConfig = { enabled?: boolean; userTurns?: number; toolCalls?: number };
export type ConfigDocument = { layers?: ConfigLayer[]; projectsDirectory?: string; review?: ReviewConfig };

/** A config file as `/memory/config/get` returns it. */
export type ConfigView = { document?: ConfigDocument; hash: string; exists: boolean; path: string; error?: string; raw?: string };
