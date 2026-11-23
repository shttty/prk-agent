import { Component } from "react";
import { createRef } from "react";
import { motionMs } from "../motion/motion-token.js";
import { motionEase } from "../motion/motion-token.js";
import { prefersReducedMotion } from "../motion/motion-token.js";
import { stripIdentity } from "../motion/ghost/strip-identity.js";
import "./crossfade.css";

// Settings page / provider swap (mock FIX-4). When `layerKey` changes, the outgoing DOM is cloned before React replaces
// it and stacked at the same spot; the clone fades out while the live layer fades in, on one curve, so their opacities
// always sum to 1. Layers are opaque and blend with plus-lighter inside an isolated host: anything identical in both
// pages stays perfectly still and no frame is see-through. A switch during a fade restarts every layer from where it
// is. The clone is inert and loses its ids; the live layer is React's.
export default class Crossfade extends Component {
  host = createRef();

  getSnapshotBeforeUpdate(previous) {
    if (previous.layerKey === this.props.layerKey || this.props.fade === false || prefersReducedMotion()) return null;
    const live = this.host.current?.querySelector(":scope > .pi-fade-live");
    if (!live) return null;
    const clone = live.cloneNode(true);
    // cloneNode copies attributes, not properties: carry form state and scroll offsets so the copy matches the original.
    const fields = live.querySelectorAll("input, textarea, select");
    const copies = clone.querySelectorAll("input, textarea, select");
    fields.forEach((field, index) => { copies[index].checked = field.checked; copies[index].value = field.value; });
    const all = [live, ...live.querySelectorAll("*")];
    const scrolls = all.flatMap((node, index) => node.scrollTop || node.scrollLeft ? [[index, node.scrollTop, node.scrollLeft]] : []);
    return { clone, scrolls, opacity: Number(getComputedStyle(live).opacity) };
  }

  componentDidUpdate(_previous, _state, snapshot) {
    if (!snapshot) return;
    const host = this.host.current;
    const live = host.querySelector(":scope > .pi-fade-live");
    const timing = { duration: motionMs("instant"), easing: motionEase("ease-swap") };
    const fadeOut = (layer, from) => {
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
    for (const layer of host.querySelectorAll(":scope > .pi-fade-leaving")) fadeOut(layer, Number(getComputedStyle(layer).opacity));
    const { clone, scrolls, opacity } = snapshot;
    clone.className = "pi-fade-leaving";
    clone.inert = true;
    clone.setAttribute("aria-hidden", "true");
    stripIdentity(clone);
    host.insertBefore(clone, live);
    const nodes = [clone, ...clone.querySelectorAll("*")];
    for (const [index, top, left] of scrolls) { nodes[index].scrollTop = top; nodes[index].scrollLeft = left; }
    fadeOut(clone, opacity);
    live.getAnimations().forEach((animation) => animation.cancel());
    live.animate([{ opacity: 0 }, { opacity: 1 }], timing);
  }

  render() {
    const { className = "", id, children, ...rest } = this.props;
    delete rest.layerKey; delete rest.fade;
    return <div ref={this.host} id={id} className={`pi-fade ${className}`} {...rest}><div className="pi-fade-live">{children}</div></div>;
  }
}
