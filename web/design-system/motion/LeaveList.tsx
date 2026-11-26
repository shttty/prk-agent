import { Component } from "react";
import type { Ghost } from "./ghost/ghost-types.ts";
import type { MotionEdge } from "./motion-types.ts";
import { captureGhost } from "./ghost/capture-ghost.ts";
import { playGhost } from "./ghost/play-ghost.ts";
import "./motion.css";

type LeaveListProps = {
  keys: readonly string[];
  find: (key: string) => HTMLElement | null | undefined;
  host?: () => HTMLElement | null;
  edge: MotionEdge;
};

/** Exit motion for a list of transient overlays (toasts, banners) keyed by `keys`: an item that leaves the list slides
 * off as an inert copy while the live one is gone at once. Renders nothing; keep it mounted where the list's container
 * may unmount. `find(key)` returns an item's node; `host()` the positioned ancestor that outlives the list, where the
 * copy goes. Entry is CSS (pi-arrive in motion.css). */
export default class LeaveList extends Component<LeaveListProps, unknown, Ghost[] | null> {
  getSnapshotBeforeUpdate(previous: LeaveListProps): Ghost[] | null {
    const gone = previous.keys.filter((key) => !this.props.keys.includes(key));
    return gone.length ? gone.map((key) => captureGhost(previous.find(key), [], this.props.host?.() ?? null)).filter((ghost) => ghost !== null) : null;
  }

  componentDidUpdate(_previous: LeaveListProps, _state: unknown, ghosts: Ghost[] | null) {
    for (const ghost of ghosts ?? []) playGhost(ghost, this.props.edge, "rise");
  }

  render() { return null; }
}
