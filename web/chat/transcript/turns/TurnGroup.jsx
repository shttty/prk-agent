import { useContext } from "react";
import { TurnProcess } from "./TurnProcess.jsx";
import { TurnContext } from "./turn-context.js";
import { SpawnSummary } from "../spawn/SpawnSummary.jsx";
import { SPAWN_TOOL } from "../spawn/spawned-children.js";

export function TurnGroup({ groupKey, indices, children }) {
  const message = useContext(TurnContext);
  if (groupKey === undefined) return <>{children}</>;
  const firstSpawn = message.content.findIndex((part) => part.type === "tool-call" && part.toolName === SPAWN_TOOL);
  // Show one turn-wide child card outside the fold, beside the first spawn.
  return <><TurnProcess groupKey={groupKey} indices={indices}>{children}</TurnProcess>
    {indices.includes(firstSpawn) ? <SpawnSummary /> : null}</>;
}
