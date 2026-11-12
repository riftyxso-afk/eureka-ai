declare module "@novnc/novnc" {
  export default class RFB extends EventTarget {
    constructor(target: HTMLElement, channel: WebSocket, options?: { shared?: boolean });
    viewOnly: boolean;
    scaleViewport: boolean;
    background: string;
    disconnect(): void;
  }
}
