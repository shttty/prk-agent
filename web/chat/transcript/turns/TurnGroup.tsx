import { useContext } from "react";
import type { ReactNode } from "react";
import { KernelImageGallery } from "../tool-calls/kernel-cell/KernelImageGallery.tsx";
import { TurnProcess } from "./TurnProcess.tsx";
import { TurnContext } from "./turn-context.ts";
import { SpawnSummary } from "../spawn/SpawnSummary.tsx";
import { SPAWN_TOOL } from "../spawn/spawned-children.ts";

export function TurnGroup({ groupKey, indices, children }: { groupKey: string | undefined; indices: number[]; children?: ReactNode }) {
  const message = useContext(TurnContext);
  if (groupKey === undefined) return <>{children}</>;
  const firstSpawn = (message?.content ?? []).findIndex((part) => part.type === "tool-call" && part.toolName === SPAWN_TOOL);
  // Show one turn-wide child card outside the fold, beside the first spawn.
  return <><TurnProcess groupKey={groupKey} indices={indices}>{children}</TurnProcess>
    {indices.map((index) => {
      const part = message?.content[index];
      return part?.type === "tool-call" && part.toolName === "kernel_code" ? <KernelImageGallery key={part.toolCallId} part={part} /> : null;
    })}
    {indices.includes(firstSpawn) ? <SpawnSummary /> : null}</>;
}
