import { Component } from "react";
import type { Ghost } from "./ghost/ghost-types.ts";
import type { MotionDistance, MotionEdge } from "./motion-types.ts";
import { captureGhost } from "./ghost/capture-ghost.ts";
import { playArrive } from "./ghost/play-arrive.ts";
import { playGhost } from "./ghost/play-ghost.ts";
import { prefersReducedMotion } from "./prefers-reduced-motion.ts";
import "./motion.css";

const WAIT_FRAMES = 120;

type PanelMotionProps = {
  shown: boolean;
  find: () => HTMLElement | null | undefined;
  edge: MotionEdge;
  distance?: MotionDistance;
  fade?: boolean;
  drop?: readonly string[];
};

/** Open/close motion for one panel that stays mounted (hidden) or mounts/unmounts with `shown`. Renders nothing; keep it
 * mounted above the panel (outside any lazy boundary). `find()` returns the panel's node; `edge` is the side it comes
 * from and leaves to; `drop` root classes its leaving copy must not keep. Only real toggles animate, never the first
 * render (a restored layout appears as it is). The live panel is hidden or gone at once, so nothing waits for the
 * animation: the leaving copy is inert and has no ids. A lazily loaded panel is awaited for about two seconds. */
export default class PanelMotion extends Component<PanelMotionProps, unknown, Ghost | null> {
  frame = 0;

  getSnapshotBeforeUpdate(previous: PanelMotionProps): Ghost | null {
    if (previous.shown && !this.props.shown) return captureGhost(this.props.find(), this.props.drop);
    return null;
  }

  componentDidUpdate(previous: PanelMotionProps, _state: unknown, ghost: Ghost | null) {
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
