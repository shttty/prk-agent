
/** A target candidate can be navigated into (directory) or attached (file); anything else (socket, device) is neither. */
export const referenceAvailable = (reference) => reference?.navigable === true || reference?.selectable === true;
