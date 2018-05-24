"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const minimist_1 = __importDefault(require("minimist"));
const state_1 = require("./state");
const connection_1 = require("./connection");
const modules_1 = require("./modules");
const args = minimist_1.default(process.argv.slice(2));
if (args.v || args.verbose) {
    state_1.state.verbose = true;
}
// Change to current dir
process.chdir(path.dirname(process.argv[1]));
// Listen for clients
function listenWS() {
    const validAddress = /^\d+\.\d+\.\d+\.\d+$/;
    const validPort = /^\d+$/;
    let address = "0.0.0.0";
    let port = null; // FIXME: Put proper WS port here
    if (args.addr) {
        address = validAddress.test(args.addr) ? args.addr : null;
    }
    if (args.port) {
        port = validPort.test(args.port) ? +args.port : null;
    }
    if (address) {
        connection_1.listen.ws(address, port);
    }
    else {
        console.error("ANV.listenWS: Invalid IP address \"" + args.addr + "\" for WebSockets");
    }
}
if (args.ipc) {
    connection_1.listen.ipc();
}
if (args.ws) {
    listenWS();
}
// Load modules
modules_1.loadModules("../modules", true);
if (args.modules) {
    // Load extra modules
    modules_1.loadModules(args.modules);
    // TODO: Check this
}
