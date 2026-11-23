/** A terminal host that is laid out and big enough to fit. Hidden (display:none, another tab, a closed workspace) or
 * sliver-sized hosts would fit to a few cells and send a bogus size to the PTY. */
export const measurable = (element) => Boolean(element) && element.offsetParent !== null && element.clientWidth >= 20 && element.clientHeight >= 20;
