import { Component, createRef, type HTMLAttributes } from "react";
import type { ScrollOffset } from "../motion/ghost/ghost-types.ts";
import { cloneElement } from "../motion/ghost/clone-element.ts";
import { readScrollOffsets } from "../motion/ghost/read-scroll-offsets.ts";
import { restoreScrollOffsets } from "../motion/ghost/restore-scroll-offsets.ts";
import { stripIdentity } from "../motion/ghost/strip-identity.ts";
import { motionMs } from "../motion/motion-ms.ts";
import { prefersReducedMotion } from "../motion/prefers-reduced-motion.ts";
import { readMotionToken } from "../motion/read-motion-token.ts";
import "./crossfade.css";

type CrossfadeProps = HTMLAttributes<HTMLDivElement> & { layerKey: string; fade?: boolean };
type Outgoing = { clone: HTMLElement; scrolls: ScrollOffset[]; opacity: number };
type FormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

// Settings page / provider swap (mock FIX-4). When `layerKey` changes, the outgoing DOM is cloned before React replaces
// it and stacked at the same spot; the clone fades out while the live layer fades in, on one curve, so their opacities
// always sum to 1. Layers are opaque and blend with plus-lighter inside an isolated host: anything identical in both
// pages stays perfectly still and no frame is see-through. A switch during a fade restarts every layer from where it
// is. The clone is inert and loses its ids; the live layer is React's.
// Exception to the layout rule: the layers overlap by design, and the clone keeps only its class, so the layer's layout
// stays in crossfade.css rather than in Mantine props the copy would not carry.
export default class Crossfade extends Component<CrossfadeProps, unknown, Outgoing | null> {
  host = createRef<HTMLDivElement>();

  getSnapshotBeforeUpdate(previous: CrossfadeProps): Outgoing | null {
    if (previous.layerKey === this.props.layerKey || this.props.fade === false || prefersReducedMotion()) return null;
    const live = this.host.current?.querySelector<HTMLElement>(":scope > .pi-fade-live");
    const clone = live && cloneElement(live);
    if (!live || !clone) return null;
    // cloneNode copies attributes, not properties: carry form state so the copy matches the original.
    const copies = clone.querySelectorAll<FormField>("input, textarea, select");
    live.querySelectorAll<FormField>("input, textarea, select").forEach((field, index) => {
      const copy = copies[index];
      if (!copy) return;
      if (field instanceof HTMLInputElement && copy instanceof HTMLInputElement) copy.checked = field.checked;
      copy.value = field.value;
    });
    return { clone, scrolls: readScrollOffsets(live), opacity: Number(getComputedStyle(live).opacity) };
  }

  componentDidUpdate(_previous: CrossfadeProps, _state: unknown, outgoing: Outgoing | null) {
    const host = this.host.current;
    const live = host?.querySelector<HTMLElement>(":scope > .pi-fade-live");
    if (!outgoing || !host || !live) return;
    const timing = { duration: motionMs("instant"), easing: readMotionToken("ease-swap") };
    const fadeOut = (layer: HTMLElement, from: number) => {
      // Restarting a fade keeps the layer; a cancellation from no-animation mode removes it.
      for (const animation of layer.getAnimations()) {
        animation.oncancel = null;
        animation.cancel();
      }
      const animation = layer.animate([{ opacity: from }, { opacity: 0 }], { ...timing, fill: "forwards" });
      animation.onfinish = animation.oncancel = () => {
        layer.remove();
        if (!host.querySelector(":scope > .pi-fade-leaving")) host.removeAttribute("data-fading");
      };
    };
    host.setAttribute("data-fading", "true");
    for (const layer of host.querySelectorAll<HTMLElement>(":scope > .pi-fade-leaving")) fadeOut(layer, Number(getComputedStyle(layer).opacity));
    const { clone, scrolls, opacity } = outgoing;
    clone.className = "pi-fade-leaving";
    clone.inert = true;
    clone.setAttribute("aria-hidden", "true");
    stripIdentity(clone);
    host.insertBefore(clone, live);
    restoreScrollOffsets(clone, scrolls);
    fadeOut(clone, opacity);
    live.getAnimations().forEach((animation) => animation.cancel());
    live.animate([{ opacity: 0 }, { opacity: 1 }], timing);
  }

  render() {
    const { className = "", children, layerKey, fade, ...rest } = this.props;
    return <div ref={this.host} className={`pi-fade ${className}`} {...rest}><div className="pi-fade-live">{children}</div></div>;
  }
}
