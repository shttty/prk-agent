import type { SerializedDockview } from "dockview-react";

export const serializeLayout = (dockview: SerializedDockview) => JSON.stringify(dockview);
