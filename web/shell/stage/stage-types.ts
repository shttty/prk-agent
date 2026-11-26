import type { DockviewApi } from "dockview-react";
import type { Engine } from "../../workspace/editor-dock/engine/engine-types.ts";
import type { SizingRecord, Extents } from "./grid/grid-types.ts";

/** What the page needs to know of the chat's place in the stage (see measureShape). */
export type StageShape = { groups: number; chatWidth: number; chatCorner: boolean };

/** The live dock of one stage: the grid, the workspace engine over it and the records the layout code keeps. */
export type StageDock = {
  grid: DockviewApi;
  engine: Engine;
  liveMain: () => string | null;
  sizing: SizingRecord;
  extents: () => Extents;
};

/** Where the stage's buttons render: in the chat column's strip, in the pinned directory's header, or in the corner group's tab row. */
export type StageControlsHost = "chat" | "tree" | "dock";
