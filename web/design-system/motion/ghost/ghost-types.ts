/** scrollTop and scrollLeft of the element at this position in `[root, ...root.querySelectorAll("*")]`. */
export type ScrollOffset = readonly [index: number, top: number, left: number];

/** A leaving element copied before React removes it, with where it was. */
export type Ghost = {
  clone: HTMLElement;
  scrolls: ScrollOffset[];
  rect: { left: number; top: number; width: number; height: number };
  fixed: boolean;
  parent: Element;
  look: Pick<CSSStyleDeclaration, "backgroundColor" | "border" | "borderRadius" | "boxShadow" | "backdropFilter" | "color">;
  /** Root classes the copy must not keep (a class a selector expects to be unique). */
  drop: readonly string[];
};
