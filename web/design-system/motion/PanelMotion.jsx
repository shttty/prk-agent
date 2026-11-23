import { Component } from "react";
import { prefersReducedMotion } from "./motion-token.js";
import { captureGhost } from "./ghost/capture-ghost.js";
import { playGhost } from "./ghost/play-ghost.js";
import { playArrive } from "./ghost/play-arrive.js";
import "./motion.css";
const WAIT_FRAMES = 120;

/** Open/close motion for one panel that stays mounted (hidden) or mounts/unmounts with `shown`. Renders nothing; keep it
 * mounted above the panel (outside any lazy boundary). `find()` returns the panel's node; `edge` is the side it comes
 * from and leaves to; `drop` root classes its leaving copy must not keep. Only real toggles animate, never the first
 * render (a restored layout appears as it is). The live panel is hidden or gone at once, so nothing waits for the
 * animation: the leaving copy is inert and has no ids. A lazily loaded panel is awaited for about two seconds. */
export default class PanelMotion extends Component {
  frame = 0;

  getSnapshotBeforeUpdate(previous) {
    if (previous.shown && !this.props.shown) return captureGhost(this.props.find(), this.props.drop);
    return null;
  }

  componentDidUpdate(previous, _state, ghost) {
    cancelAnimationFrame(this.frame);
    if (prefersReducedMotion()) return;
    const { edge, distance, fade } = this.props;
    if (ghost) { playGhost(ghost, edge, distance); return; }
    if (previous.shown || !this.props.shown) return;
    let waited = 0;
    const arrive = () => {
      const node = this.props.find();
      if (node?.offsetWidth) playArrive(node, edge, distance, fade);
      else if (++waited < WAIT_FRAMES && this.props.shown) this.frame = requestAnimationFrame(arrive);
    };
    arrive();
  }

  componentWillUnmount() { cancelAnimationFrame(this.frame); }

  render() { return null; }
}
