export interface LimitsOptions {
  readonly inputBytes: number;
  readonly outputBytes: number;
  readonly historyPageBytes: number;
  readonly identityChars: number;
  readonly labelChars: number;
  readonly sshCommandChars: number;
  readonly cwdChars: number;
  readonly contextFileBytes: number;
  readonly contextTotalBytes: number;
  readonly tagsMax: number;
  readonly tagChars: number;
  readonly modelChars: number;
  readonly messageChars: number;
  readonly requestIdChars: number;
  readonly operationIdChars: number;
  readonly actionChars: number;
  readonly attachmentNameChars: number;
  readonly mimeTypeChars: number;
  readonly attachmentsMax: number;
  readonly attachmentBytes: number;
  readonly attachmentTotalBytes: number;
  readonly referencesMax: number;
  readonly referenceTextChars: number;
  readonly referenceFieldChars: number;
  readonly socketPathBytes: number;
  readonly augmentedMessageBytes: number;
  readonly nativeTreeNodes: number;
  readonly nativeTreeDepth: number;
  readonly exportEnvelopeReserveBytes: number;
  readonly bindingMessageChars: number;
  readonly scopedModelsMax: number;
  readonly derivedSummaryChars: number;
  readonly derivedArtifactsMax: number;
  readonly derivedTaskChars: number;
  readonly forkLabelChars: number;
}
export const DEFAULT_LIMITS_OPTIONS: LimitsOptions = Object.freeze({
  inputBytes: 1024 * 1024,
  outputBytes: 8 * 1024 * 1024,
  historyPageBytes: 3 * 1024 * 1024,
  identityChars: 256,
  labelChars: 200,
  sshCommandChars: 2048,
  cwdChars: 4096,
  contextFileBytes: 64 * 1024,
  contextTotalBytes: 256 * 1024,
  tagsMax: 20,
  tagChars: 64,
  modelChars: 512,
  messageChars: 262144,
  requestIdChars: 256,
  operationIdChars: 512,
  actionChars: 128,
  attachmentNameChars: 256,
  mimeTypeChars: 128,
  attachmentsMax: 4,
  attachmentBytes: 384 * 1024,
  attachmentTotalBytes: 640 * 1024,
  referencesMax: 32,
  referenceTextChars: 262144,
  referenceFieldChars: 4096,
  socketPathBytes: 100,
  augmentedMessageBytes: 320 * 1024,
  nativeTreeNodes: 512,
  nativeTreeDepth: 64,
  exportEnvelopeReserveBytes: 4096,
  bindingMessageChars: 500,
  scopedModelsMax: 32,
  derivedSummaryChars: 32768,
  derivedArtifactsMax: 100,
  derivedTaskChars: 65536,
  forkLabelChars: 190,
});
