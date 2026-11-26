import type { Dispatch, MouseEvent, PointerEvent, RefObject, SetStateAction } from "react";
import type { PageActions } from "../../shell/page/page-types.ts";
import type { ProviderError } from "../plugins/plugin-types.ts";

/** A tool or skill saved in the library (staging, promoted or archived). */
export type LibraryEntry = {
  name: string; status: string; manual?: boolean; version?: number; scope?: string; description?: string; docstring?: string;
  distinctSessions?: number; successfulCalls?: number; lastUsedAt?: string; whenToUse?: string; evidence?: string; body?: string;
  files?: string[]; reason?: string; signature?: string; source?: string;
};

/** The lazy-load switch of a tool or group, with its state at this layer. */
export type LazyState = { id: string; enabled?: boolean; available?: boolean; overridden?: boolean; defaultEnabled?: boolean };

/** One catalog row (a tool or a skill), plus what the page projects onto it (`catalogued`, `library`, effective flags). */
export type CapabilityEntry = {
  id: string; kind?: string; name: string; description?: string; group: string; groupLabel?: string; enabled?: boolean; configured?: boolean; locked?: boolean;
  available?: boolean; groupEnabled?: boolean; lazy?: LazyState; exposure?: string; overridden?: boolean; defaultEnabled?: boolean; shadowedBy?: string;
  source?: string; module?: string; moduleOnly?: boolean; overridesBuiltin?: boolean; error?: string; pending?: boolean; catalogued?: boolean; library?: LibraryEntry;
};

export type CapabilityGroup = {
  id: string; kind?: string; name: string; enabled?: boolean; available?: boolean; overridden?: boolean; lazy?: LazyState; instance?: string; path?: string; defaultEnabled?: boolean;
};

export type CapabilityCatalog = { groups: CapabilityGroup[]; entries: CapabilityEntry[]; providerErrors?: ProviderError[] };

/** `/capabilities`: the catalog plus the instance error and PRK's own terminal settings. */
export type CapabilityData = { catalog?: CapabilityCatalog; terminal?: ConfigValues; instanceError?: string };

/** A plugin or terminal config file's values: JSON, addressed by dot paths. */
export type ConfigValues = Record<string, unknown>;

export type FieldType = "boolean" | "select" | "number" | "list" | "json" | "string";

export type ConfigField = {
  key: string; label: string; type: FieldType; options?: string[]; description?: string; secret?: boolean; scale?: number; unit?: string; min?: number;
  itemType?: "number"; default?: unknown[];
};

export type ConfigSection = { title: string; fields: ConfigField[] };

/** `/plugin-config/get`: how one provider's config file reads. */
export type ProviderConfigView = { configured: boolean; sections: ConfigSection[]; secrets: string[]; values: ConfigValues; file: string; exists: boolean };

/** One write of the capability switches: `enabled: null` drops this layer's own value. */
export type CapabilityChange = { id: string; enabled: boolean | null };

export type PeekMode = "hover" | "touch";
export type Peek = { entry: { id: string }; row: Element | null; mode: PeekMode; x?: number; y?: number; pinned?: boolean };
export type PressState = { x: number; y: number; fired: boolean; sticky: boolean; timer?: ReturnType<typeof setTimeout> };

export type CapabilityKind = "tools" | "skills";

export type CatalogView = {
  catalog: CapabilityCatalog | undefined; savedGroup: string; savedLabel: string; savedEmpty: string; entries: CapabilityEntry[]; names: Set<string>;
  groups: CapabilityGroup[]; counts: Map<string, number>; providers: CapabilityGroup[];
};

export type GroupHits = { show: boolean; all: boolean; rows: CapabilityEntry[] };

type State<T> = Dispatch<SetStateAction<T>>;

/** The panel's shared bag: its state, derived catalog and the operations bound to them, handed to the list, the detail, the layers and the peek card. */
export type CapabilityCtx = CatalogView & {
  kind: CapabilityKind; actions: PageActions; targets: { id: string; label?: string }[]; session: boolean; instance: string; sessionKey: string; localTools: unknown; mobile: boolean;
  setLoading: State<boolean>; data: CapabilityData | null; setData: State<CapabilityData | null>; library: LibraryEntry[]; setLibrary: State<LibraryEntry[]>; selected: string | null; setSelected: State<string | null>;
  query: string; setQuery: State<string>; loading: boolean; refreshing: boolean; saving: boolean; setSaving: State<boolean>; error: string; setError: State<string>;
  deletion: LibraryEntry | null; setDeletion: State<LibraryEntry | null>; frame: Element | null;
  sheet: { id: string | null; open: boolean }; setSheet: State<{ id: string | null; open: boolean }>; config: { id: string | null; open: boolean }; setConfig: State<{ id: string | null; open: boolean }>;
  drafts: Record<string, ConfigValues>; setDrafts: State<Record<string, ConfigValues>>; configs: Record<string, ProviderConfigView>; setConfigs: State<Record<string, ProviderConfigView>>;
  pathDraft: string | null; setPathDraft: State<string | null>; written: string | null; setWritten: State<string | null>;
  peek: Peek | null; setPeek: State<Peek | null>; peekOpen: boolean; setPeekOpen: State<boolean>; timers: RefObject<{ hover: ReturnType<typeof setTimeout> | undefined; hide: ReturnType<typeof setTimeout> | undefined }>;
  press: RefObject<PressState | null>; swallow: RefObject<boolean>; showPeek: (next: Peek) => void; scheduleHide: () => void; generation: RefObject<number>; listRef: RefObject<HTMLDivElement | null>; load: (refresh?: boolean) => Promise<void>;
  peekRef: RefObject<Peek | null>; hidePeek: () => void; rowHandlers: (entry: CapabilityEntry) => RowHandlers; waiting: boolean; needle: string; hits: (item: CapabilityGroup) => GroupHits;
  visible: CapabilityGroup[]; current: CapabilityGroup | undefined; scope: LibraryScope; scopeLabel: (value: string) => string; pending: boolean; disabled: (entry: CapabilityEntry) => boolean;
  configurable: boolean; shadower: (id: string) => string; configGroup: CapabilityGroup | undefined; terminal: ConfigValues | undefined; providerConfig: ProviderConfigView | undefined;
  sheetGroup: CapabilityGroup | undefined; peekEntry: CapabilityEntry | null;
  change: (idOrChanges: string | CapabilityChange[], enabled?: boolean | null) => Promise<void>; mutateLibrary: (action: string, entry: LibraryEntry) => Promise<void>;
  saveTerminal: (keys: string[]) => Promise<void>; callConfig: (id: string, route: string, body: object) => Promise<ProviderConfigView | null>; openConfig: (item: CapabilityGroup) => void;
};

export type RowHandlers = {
  onPointerEnter: (event: PointerEvent<HTMLElement>) => void; onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void; onClick: (event: MouseEvent<HTMLElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
};

export type ScopeChoice = { value: string; label: string } | { group: string; items: { value: string; label: string }[] };
export type LibraryScope = { options: (value: string) => ScopeChoice[]; onChange: (entry: LibraryEntry, value: string) => Promise<void> };
