import type { NativeInteractionService } from "../../sessions/native-interaction/native-types.ts";
import type { SendRecords } from "./send-records/send-record-types.ts";

export interface InteractionState {
  nativeInteractions: NativeInteractionService;
  sendRecords: SendRecords;
}
