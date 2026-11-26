/** Identifies one kernel cell; the Gateway serves its images by index. */
export type KernelCellRef = { sessionId: string; kernelId: string; cellId: string; toolCallId: string };
export type KernelImageLoader = (cell: KernelCellRef, index: number) => Promise<string>;
