export const unsupported = async (): Promise<never> => { throw new Error("Session replacement/navigation is unsupported by the retained host."); };
