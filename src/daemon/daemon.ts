import * as path from "path";
import minimist from "minimist";
import {state} from "./state";
import {Task, MediaStatus, crud} from "./tasks";
import {Connection, listen} from "./connection";
import {loadModules} from "./modules";
import {clock} from "./clock";
import {facetStore, getFacet} from "./facets";
import {instructions} from "./clients";
import {getByteSuffix} from "./utils";

const args = minimist(process.argv.slice(2));

if (args.v || args.verbose) {
  state.verbose = true;
}

// Change to current dir
process.chdir(path.dirname(process.argv[1]));

// Load modules
loadModules("../modules", true);

if (args.modules) {
  // Load extra modules
  loadModules(args.modules);
  // TODO: Check this
}

// Start ticking
const mainClock = clock();

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

// Create fake client request
state.task.dlPath = "/home/b-fuse/old/tmp/anv-test";

console.log("ANV & Client test");
const taskUrl = "http://www.animerush.tv/anime/Ooyasan-wa-Shishunki/";
const taskUrl2 = "http://www.animerush.tv/anime/Komori-san-wa-Kotowarenai/";

instructions.load(taskUrl, (err, taskId) => {
  if (err) {
    console.error(err);
  } else {
    const task = crud.getTask(taskId);

    task.on("load", load => {

      // Start task
      task.active = true;
    });
  }
});

instructions.load(taskUrl2, (err, taskId) => {
  if (err) {
    console.error(err);
  } else {
    const task = crud.getTask(taskId);

    task.on("load", load => {

      // Start task
      task.active = true;
    });
  }
});

mainClock.event.on("tick", intervals => {
  if (intervals[1000]) {
    let printed = false;

    for (const task of crud.getTasks()) {
      if (task.active) {
        let downloading = 0;
        let report = "";

        for (const media of task.list) {
          if (media.status === MediaStatus.ACTIVE) {
            downloading++;
            report += ` - MEDIA #${ media.id } - ${ Math.floor(100 * (media.bytes / media.size)) }% - ${ getByteSuffix(media.size) } - ${ getByteSuffix(media.speed) }/s - ${ media.fileName }\n`;
          }
        }

        if (downloading) {
          console.log(`TASK #${ task.id } - ${ downloading } active\nTitle: ${ task.title }\n` + report + "\n");
          printed = true;
        }
      }
    }

    if (printed) {
      console.log("---------------------------------");
    }
  }
});
