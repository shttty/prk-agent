
export const BUSY_STATES = new Set(["starting", "running", "cancel_requested", "closing"]);

// Clone needs a quiet source: the Gateway refuses while a turn runs, so only offer it when there is no running turn.
export const CLONEABLE_STATES = new Set(["idle", "sleeping", "unavailable", "closed"]);

export const MAX_TREE_DEPTH = 12;
