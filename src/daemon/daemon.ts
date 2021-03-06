import * as fs from "fs";
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

// Follow symlinks when loading modules
if (!!args["follow-symlinks"] || !!args.s) {
  state.moduleFollowSymlinks = true;
}

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
state.task.dlPath = "/home/b-fuse/old/tmp/anv-test/test3";
state.maxGlobalConcurrentDl = 3;
state.limitOnlyGlobal = true;

console.log("ANV & Client test");
const taskUrl = "https://gogoanime.sh/category/hisone-to-maso-tan";
const taskUrl2 = "https://gogoanime.sh/category/last-period-owarinaki-rasen-no-monogatari";
const taskUrl3 = "http://www.animerush.tv/anime/shakugan-no-shana-iii/";

// fs.readdir(state.task.dlPath, (err, files) => {
const files = [
  "Hisone to Maso-tan",
];

for (const file of files) {
  const localPath = state.task.dlPath + path.sep + file;

  instructions.loadLocal(localPath, false, (err, taskId) => {
    if (err) {
      console.log("Error loading local task - " + localPath);
    } else {
      const task = crud.getTask(taskId);

      console.log("Successfully loaded task - " + taskId);
      console.dir(task, {depth: null, color: true});

      // Start task
      task.active = true;
    }
  });
}


// });
//
// instructions.load(taskUrl, (err, taskId) => {
//   if (err) {
//     console.error(err);
//   } else {
//     const task = crud.getTask(taskId);
//
//     task.on("load", load => {
//       // for (const m of task.list) {
//       //   if (+m.title <= 10) {
//       //     m.selected = false;
//       //   }
//       // }
//
//       // Start task
//       task.active = true;
//     });
//   }
// });
//
// instructions.load(taskUrl2, (err, taskId) => {
//   if (err) {
//     console.error(err);
//   } else {
//     const task = crud.getTask(taskId);
//
//     task.on("load", load => {
//       // Start task
//       task.active = true;
//     });
//   }
// });

// instructions.load(taskUrl4, (err, taskId) => {
//   if (err) {
//     console.error(err);
//   } else {
//     const task = crud.getTask(taskId);
//
//     task.on("load", load => {
//
//       // Start task
//       task.active = true;
//     });
//   }
// });

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

console.log("DEBUG", (<any> global).ANV);

process.on("SIGINT", () => {
  mainClock.stop(() => {
    console.log("");
    const tasks = crud.getTasks();
    let cancel = tasks.length;
    let canceled = 0;

    for (const task of tasks) {
      instructions.stop(task.id, err => {
        canceled++;

        if (canceled === cancel) {
          process.nextTick(() => {
            process.exit();
          });
        }
      });
      console.log("Stopped task #" + task.id + " - " + task.title);
    }
  });
});
