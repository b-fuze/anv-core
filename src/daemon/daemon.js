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
const tasks_1 = require("./tasks");
const connection_1 = require("./connection");
const modules_1 = require("./modules");
const clock_1 = require("./clock");
const clients_1 = require("./clients");
const utils_1 = require("./utils");
const args = minimist_1.default(process.argv.slice(2));
if (args.v || args.verbose) {
    state_1.state.verbose = true;
}
// Change to current dir
process.chdir(path.dirname(process.argv[1]));
// Load modules
modules_1.loadModules("../modules", true);
if (args.modules) {
    // Load extra modules
    modules_1.loadModules(args.modules);
    // TODO: Check this
}
// Start ticking
const mainClock = clock_1.clock();
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
// Create fake client request
state_1.state.task.dlPath = "/home/b-fuse/old/tmp/anv-test/test3";
state_1.state.maxGlobalConcurrentDl = 3;
state_1.state.limitOnlyGlobal = true;
state_1.state.maxSourceRetries = 1;
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
    const localPath = state_1.state.task.dlPath + path.sep + file;
    clients_1.instructions.loadLocal(localPath, false, (err, taskId) => {
        if (err) {
            console.log("Error loading local task - " + localPath);
        }
        else {
            const task = tasks_1.crud.getTask(taskId);
            console.log("Successfully loaded task - #" + taskId + " " + task.title);
            // console.dir(task, {depth: null, color: true});
            // Start task
            task.active = true;
        }
    });
}
// });
clients_1.instructions.load(taskUrl, (err, taskId) => {
    if (err) {
        console.error(err);
    }
    else {
        const task = tasks_1.crud.getTask(taskId);
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
        for (const task of tasks_1.crud.getTasks()) {
            if (task.active) {
                let downloading = 0;
                let report = "";
                for (const media of task.list) {
                    if (media.status === tasks_1.MediaStatus.ACTIVE) {
                        downloading++;
                        report += ` - MEDIA #${media.id} - ${Math.floor(100 * (media.bytes / media.size))}% - ${utils_1.getByteSuffix(media.size)} - ${utils_1.getByteSuffix(media.speed)}/s - ${media.fileName}\n`;
                    }
                }
                if (downloading) {
                    console.log(`TASK #${task.id} - ${downloading} active\nTitle: ${task.title}\n` + report + "\n");
                    printed = true;
                }
            }
        }
        if (printed) {
            console.log("---------------------------------");
        }
    }
});
console.log("DEBUG", global.ANV);
process.on("SIGINT", () => {
    mainClock.stop(() => {
        console.log("");
        const tasks = tasks_1.crud.getTasks();
        let cancel = tasks.length;
        let canceled = 0;
        for (const task of tasks) {
            clients_1.instructions.stop(task.id, err => {
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
