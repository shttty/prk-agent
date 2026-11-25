import type { FileDownload, FileUpload } from "../../../workspace/target-files/files-types.ts";
import type { Socket } from "node:net";
import type { ListenerContext } from "../listener-state.ts";

export interface PeerContext {
  readonly listener: ListenerContext;
  readonly socket: Socket;
  unsubscribeHost: (() => void) | undefined;
  unsubscribeSessions: (() => void) | undefined;
  unsubscribeTerminal: (() => void) | undefined;
  subscribedSessionId: string | undefined;
  unsubscribeRoutes: (() => void) | undefined;
  fileTransfer?: { method: "filesDownload"; stream: FileDownload } | { method: "filesUpload"; stream: FileUpload };
  advancingFileTransfer?: boolean;
  lastId: number;
  pending: number;
}

export type Respond = (id: number, result: unknown) => boolean;
