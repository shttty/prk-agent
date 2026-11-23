import { Component } from "react";
import { captureGhost } from "./ghost/capture-ghost.js";
import { playGhost } from "./ghost/play-ghost.js";
import "./motion.css";

/** Exit motion for a list of transient overlays (toasts, banners) keyed by `keys`: an item that leaves the list slides
 * off as an inert copy while the live one is gone at once. Renders nothing; keep it mounted where the list's container
 * may unmount. `find(key)` returns an item's node; `host()` the positioned ancestor that outlives the list, where the
 * copy goes. Entry is CSS (pi-arrive in motion.css). */
export default class LeaveList extends Component {
  getSnapshotBeforeUpdate(previous) {
    const gone = previous.keys.filter((key) => !this.props.keys.includes(key));
    return gone.length ? gone.map((key) => captureGhost(previous.find(key), [], this.props.host?.() ?? null)).filter(Boolean) : null;
  }

  componentDidUpdate(_previous, _state, ghosts) {
    for (const ghost of ghosts || []) playGhost(ghost, this.props.edge, "rise");
  }

  render() { return null; }
}
