import { TurnProcess } from "./TurnProcess.jsx";
import { SpawnSummary } from "../spawn/SpawnSummary.jsx";
export function TurnGroup({ groupKey, indices, children }) {
  if (groupKey !== "process") return <>{children}</>;
  // The spawned-children card stays outside the fold, so it is seen while the process is folded.
  return <><TurnProcess indices={indices}>{children}</TurnProcess><SpawnSummary /></>;
}
