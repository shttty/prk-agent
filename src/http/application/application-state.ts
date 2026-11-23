import type { WebServer } from "../listener/listener-types.ts";
import type { WebGatewayConnection } from "../gateway-connection/client-types.ts";

export interface ApplicationContext { readonly server: WebServer; readonly gateway: WebGatewayConnection; closing: Promise<void> | undefined; }
