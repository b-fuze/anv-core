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
state.maxSourceRetries = 1;

console.log("ANV & Client test");
// const taskUrl = "http://www.animerush.tv/anime/Uma-Musume-Pretty-Derby-TV/";
// const taskUrl = "https://www3.gogoanime.se/category/solty-rei";
const taskUrl = "https://www4.gogoanime.se/category/teekyuu";
const taskUrl2 = "https://www4.gogoanime.se/category/teekyuu-2";
const taskUrl3 = "https://www4.gogoanime.se/category/teekyuu-3";
const taskUrl4 = "https://www4.gogoanime.se/category/teekyuu-4";
// const taskUrl2 = "http://www.animerush.tv/anime/Tokyo-Ghoul-re/";

// fs.readdir(state.task.dlPath, (err, files) => {
const files = [
  "Comic Girls",
];

for (const file of files) {
  const localPath = state.task.dlPath + path.sep + file;

  instructions.loadLocal(localPath, false, (err, taskId) => {
    if (err) {
      console.log("Error loading local task - " + localPath);
    } else {
      const task = crud.getTask(taskId);

      console.log("Successfully loaded task - #" + taskId + " " + task.title);
      // console.dir(task, {depth: null, color: true});

      // Start task
      task.active = true;
    }
  });
}
// });

instructions.load(taskUrl, (err, taskId) => {
  if (err) {
    console.error(err);
  } else {
    const task = crud.getTask(taskId);

    task.on("load", load => {
      // Start task
      // for (const m of task.list) {
      //   m.selected = false;
      //
      //   if (+m.title === 5) {
      //     m.selected = true;
      //   }
      // }
      task.list[0] = undefined;

      // console.dir(task, {depth: null, color: true});
      task.active = true;
    });
  }
});

// instructions.load(taskUrl2, (err, taskId) => {
//   if (err) {
//     console.error(err);
//   } else {
//     const task = crud.getTask(taskId);
//
//     task.on("load", load => {
//       // for (const m of task.list) {
//       //   if (+m.title < 5) m.selected = false;
//       // }
//
//       // Start task
//       task.active = true;
//     });
//   }
// });
//
// instructions.load(taskUrl3, (err, taskId) => {
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
//
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
