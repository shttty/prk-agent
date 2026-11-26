import type { SerializedDockview } from "dockview-react";

/** A file or diff tab as the editor tracks it: the dock panel id and the path it shows. */
export type PathPanel = { id: string; path: string };

/** One group of a saved dock grid (a grid leaf's data). */
export type SavedGroup = Exclude<SerializedDockview["grid"]["root"]["data"], unknown[]>;
