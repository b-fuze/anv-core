import {instruction as clientInstruction} from "./clients";

export const connections: Connection[] = [];

export interface ConnectionChannel {
  send(data: any): void;
}

export
class Connection {
  id: number;
  lastUpdate: number;
  channel: ConnectionChannel;

  constructor(
    // ipc: Inter-Process Communication, ws: WebSockets
    public type: "ipc" | "ws" = "ipc",
    wsChannel: any = null,
  ) {
    this.id = connections.length;
    connections.push(this);

    this.lastUpdate = 0;

    if (this.type === "ws") {
      this.connectWS(this.channel);

      this.channel = {
        send(data) {
          // FIXME: Websockets probably doesn't work this way
          wsChannel.send(data);
        }
      }
    } else {
      this.channel = {
        send(data) {
          process.send(data);
        }
      }
    }
  }

  connectIPC() {

  }

  connectWS(req: any) {

  }

  clientInstruction(data: any) {
    clientInstruction<Connection>(data, this);
  }

  send(data: any) {
    this.channel.send(data);
  }

  destroy() {
    connections[this.id] = null;
  }
}

export const listen = {
  ipc() {
    new Connection();
  },

  ws(address: any, port: number) {
    // TODO: ...
  }
}
