"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const clients_1 = require("./clients");
exports.connections = [];
class Connection {
    constructor(
    // ipc: Inter-Process Communication, ws: WebSockets
    type = "ipc", wsChannel = null) {
        this.type = type;
        this.id = exports.connections.length;
        exports.connections.push(this);
        this.lastUpdate = 0;
        if (this.type === "ws") {
            this.connectWS(this.channel);
            this.channel = {
                send(data) {
                    // FIXME: Websockets probably doesn't work this way
                    wsChannel.send(data);
                }
            };
        }
        else {
            this.channel = {
                send(data) {
                    process.send(data);
                }
            };
        }
    }
    connectIPC() {
    }
    connectWS(req) {
    }
    clientInstruction(data) {
        clients_1.instruction(data, this);
    }
    send(data) {
        this.channel.send(data);
    }
    destroy() {
        exports.connections[this.id] = null;
    }
}
exports.Connection = Connection;
exports.listen = {
    ipc() {
        new Connection();
    },
    ws(address, port) {
        // TODO: ...
    }
};
