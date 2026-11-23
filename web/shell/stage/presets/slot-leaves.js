/** The leaves of a planned layout (planSlots), in tree order. */
export const slotLeaves = (node) => (node.type === "leaf" ? [node] : node.data.flatMap(slotLeaves));
