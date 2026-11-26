/** The computed value of a CSS custom property on `element`. */
export const css = (element: Element, name: string) => getComputedStyle(element).getPropertyValue(name).trim();
