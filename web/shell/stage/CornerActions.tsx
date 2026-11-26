import type { IDockviewHeaderActionsProps } from "dockview-react";
import { Flex } from "@mantine/core";
import { useContext, useEffect, useState } from "react";
import { cornerGroup } from "./grid/corner-group.ts";
import { stageGrid } from "./grid/grid-of.ts";
import { StageControlsContext } from "./stage-controls-context.ts";

/** The right end of every group's tab row (dockview's header-actions slot). The stage's buttons render here in the
 * group that holds the stage's top-right corner, as plain content of the row, so the tabs only ever get the room the
 * row has left. Which group that is follows the serialized grid and is re-read after every layout change. */
export function CornerActions({ containerApi, group }: IDockviewHeaderActionsProps) {
  const stage = useContext(StageControlsContext);
  const [corner, setCorner] = useState(false);
  useEffect(() => {
    const update = () => setCorner(cornerGroup(stageGrid(containerApi.toJSON().grid)) === group.id);
    update();
    const subscription = containerApi.onDidLayoutChange(update);
    return () => subscription.dispose();
  }, [containerApi, group]);
  return corner && stage?.host === "dock" ? <Flex h="100%" align="center" pr={6}>{stage.controls}</Flex> : null;
}
