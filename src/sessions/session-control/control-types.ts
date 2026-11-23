export interface ControlActor {
  readonly sessionId: string;
  readonly root: boolean;
  readonly supervisor: boolean;
  readonly projectId?: string;
}

export interface ControlTarget {
  readonly ownerChain: readonly string[];
  readonly projectId?: string;
}

export interface SupervisorCandidate {
  readonly sessionId: string;
  readonly createdAt: number;
}

/** Project-owned role choices only; membership and ownership remain in SDK history. */
export interface SessionControl {
  readonly rootSessionId: string | null;
  readonly supervisors: Readonly<Record<string, string>>;
}

export interface SessionRoles {
  readonly root: boolean;
  readonly supervisor: boolean;
}
