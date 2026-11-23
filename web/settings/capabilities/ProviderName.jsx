import { useState } from "react";
import { Tooltip } from "@mantine/core";
import { GroupName } from "./GroupName.jsx";
// The full label shows in a Tooltip on hover, and only when something is actually cut (measured on hover).
export function ProviderName({ item, parts }) {
  const [cut, setCut] = useState(false);
  const measure = (event) => {
    const node = event.currentTarget;
    setCut(node.scrollWidth > node.clientWidth || [...node.children].some((child) => child.scrollWidth > child.clientWidth));
  };
  return <Tooltip label={item.name} disabled={!cut} multiline maw={420} position="top-start" openDelay={150} style={{ overflowWrap: "anywhere" }}>
    <span className="capability-provider-name" data-split={parts ? "true" : undefined} onMouseEnter={measure}>{parts ? <GroupName parts={parts} /> : item.name}</span>
  </Tooltip>;
}
