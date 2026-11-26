import type { PublicExecutionTarget, SessionControl } from "../../../src/gateway/wire/web-types.ts";
import type { SessionRow, SessionRows, UnreadableIssue } from "../session-row-types.ts";

/** A row of an unreadable session, shaped for grouping; the optional fields stay empty so it reads like a `SessionRow`. */
export type UnreadableItem = {
  key: string;
  sessionId: string;
  label: string;
  target: string;
  state: "unreadable";
  unreadable: UnreadableIssue;
  projectId?: undefined;
  projectName?: undefined;
  projectCreated?: undefined;
  derivation?: undefined;
};
export type SidebarItem = SessionRow | UnreadableItem;

/** What grouping needs of a row: archived sessions and unreadable rows have this shape too. */
export type Groupable = { sessionId: string; target?: string; projectId?: string; projectName?: string; projectCreated?: string; key?: string };

/** One instance or project heading with the rows under it. */
export type SessionGroup<Item extends Groupable = SidebarItem> = { id: string; name: string; sessions: Item[]; target?: PublicExecutionTarget | null; created?: string };
export type TargetMap = ReadonlyMap<string, PublicExecutionTarget>;
/** `{ id, name }` of a project heading, the payload of assigning a session to it. */
export type ProjectPayload = { id: string; name: string };

/** Derived sessions hang under their manager; `collapsed` holds the rows whose children are hidden. */
export type TreeState = { childrenOf: ReadonlyMap<string, SessionRow[]>; collapsed: ReadonlySet<string>; toggle: (sessionId: string) => void };

/** What every row reads from the workbench: the sessions and which of their actions are in flight. */
export type RowContext = {
  sessions: SessionRows;
  selectedSessionId: string | null;
  sessionControl: SessionControl | null;
  nativeActionPending: boolean;
  renaming: boolean;
  sessionManaging: boolean;
  recovering: boolean;
  archiving: boolean;
  projectMutating: boolean;
};

/** Moving a session between projects by dragging its row: which row is in the air, and the two ends of the gesture. */
export type SessionDrag = { draggedSessionId: string | null; onStart: (sessionRow: SessionRow) => void; onEnd: () => void };

/** Opens a management dialog (create, targets, project actions…) for an instance or project. */
export type OpenDialog = (type: string, targetName?: string, project?: ProjectPayload) => void;

/** What the row's "…" menu fires: the action name and the session it is about. */
export type SessionAction = (type: string, sessionId: string) => void;
