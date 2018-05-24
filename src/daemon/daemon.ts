import * as path from "path";
import minimist from "minimist";
import {state} from "./state";
import {Task, crud} from "./tasks";
import {Connection, listen} from "./connection";
import {loadModules} from "./modules";

const args = minimist(process.argv.slice(2));

if (args.v || args.verbose) {
  state.verbose = true;
}

// Change to current dir
process.chdir(path.dirname(process.argv[1]));

// Listen for clients

function listenWS() {
  const validAddress = /^\d+\.\d+\.\d+\.\d+$/;
  const validPort = /^\d+$/;

  let address = "0.0.0.0";
  let port: number = null; // FIXME: Put proper WS port here

  if (args.addr) {
    address = validAddress.test(args.addr) ? args.addr : null;
  }

  if (args.port) {
    port = validPort.test(args.port) ? +args.port : null;
  }

  if (address) {
    listen.ws(address, port);
  } else {
    console.error("ANV.listenWS: Invalid IP address \"" + args.addr + "\" for WebSockets");
  }
}

if (args.ipc) {
  listen.ipc();
}

if (args.ws) {
  listenWS();
}

// Load modules

loadModules("../modules", true);

if (args.modules) {
  // Load extra modules
  loadModules(args.modules);
  // TODO: Check this
}
