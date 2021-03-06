"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const utils_1 = require("./utils");
const state_1 = require("./state");
const tasks_1 = require("./tasks");
const tick_1 = require("./tick");
const queue_1 = require("./queue");
const serialize_1 = require("./serialize");
function taskActiveCount(task) {
    return task.list.filter(m => (m.selected && m.status === tasks_1.MediaStatus.ACTIVE)).length;
}
function taskFinishedCount(task) {
    return Math.max(task.list.filter(m => (m.selected && m.status === tasks_1.MediaStatus.FINISHED)).length - task.finishedFromStart, 0);
}
function getTasksByFairness(tasks) {
    return (state_1.state.taskFairness
        ? tasks.slice().sort((a, b) => (taskFinishedCount(a) - taskFinishedCount(b)) + (taskActiveCount(a) - taskActiveCount(b)))
        : tasks.slice());
}
// FIXME: Unnecessary term clash made this a requirement
const sourceQueueMap = {
    direct: "provider",
    mirror: "mirror",
};
function exhuastedConcurrent(task, activeMedia, setActive) {
    return (state_1.state.maxGlobalConcurrentDl
        && state_1.tmpState.currentDl >= state_1.state.maxGlobalConcurrentDl
        && activeMedia === task.currentDl
        || !state_1.state.maxGlobalConcurrentDl
            && activeMedia >= state_1.state.maxConcurrentDl);
}
function clock() {
    let stop;
    let backlog = 0;
    function increaseBacklog() {
        backlog++;
    }
    function decreaseBacklog() {
        backlog--;
        if (backlog === 0 && stop) {
            stop(null);
        }
    }
    const clock = tick_1.startTick([50, state_1.state.tickDelay, 2000], (tasks, intervals) => {
        let available = state_1.state.maxGlobalConcurrentDl
            ? state_1.state.maxGlobalConcurrentDl - state_1.tmpState.currentDl
            : 1;
        let oldAvailable = available;
        let iterations = 0;
        // Add new media
        while (!iterations || available > 0 && !(iterations && oldAvailable === available)) {
            oldAvailable = available;
            taskLoop: for (const task of getTasksByFairness(tasks)) {
                if (!task.active) {
                    continue taskLoop;
                }
                let activeMedia = 0;
                let setActive = 0;
                mediaLoop: for (const media of task.list) {
                    if (media.selected) {
                        if (media.status !== tasks_1.MediaStatus.FINISHED) {
                            if (media.status === tasks_1.MediaStatus.IDLE || media.status === tasks_1.MediaStatus.PAUSED) {
                                if (!exhuastedConcurrent(task, activeMedia, setActive)) {
                                    media.start();
                                    setActive++;
                                    if (!state_1.state.maxGlobalConcurrentDl) {
                                        available--;
                                    }
                                }
                            }
                            if (media.status === tasks_1.MediaStatus.ACTIVE || media.status === tasks_1.MediaStatus.PENDING) {
                                activeMedia++;
                            }
                            if (state_1.state.taskFairness && setActive) {
                                break mediaLoop;
                            }
                            if (exhuastedConcurrent(task, activeMedia, setActive)) {
                                break mediaLoop;
                            }
                        }
                    }
                }
            }
            iterations++;
        }
        // Iterate pending media
        for (const media of tasks_1.crud.getPendingMedia()) {
            if (media.pendingBlocked) {
                continue;
            }
            let mediaSource = media.getSource();
            // Get parent mirror facet if any
            if (mediaSource.type === "stream" && mediaSource.parentType === "mirror") {
                mediaSource = tasks_1.crud.getMediaSource(mediaSource.parent);
            }
            const queueFacet = media.queueFacet;
            const queueId = media.queueId;
            if (queue_1.queueState(queueFacet, mediaSource.facetId, media.queueId) === queue_1.QueueState.READY) {
                // Media is ready in queue
                media.start();
                queue_1.advanceQueue(queueFacet, mediaSource.facetId, true, true);
            }
        }
        if (intervals[state_1.state.tickDelay]) {
            // Iterate active media
            for (const media of tasks_1.crud.getActiveMedia()) {
                if (media.request) {
                    if (!media.streamResolver.external && media.outStream) {
                        // The stream resolver is internal, proceed to calculate speed, etc
                        const now = Date.now();
                        const dur = now - media.lastUpdate;
                        const bytes = media.bufferedBytes;
                        media.speed = Math.floor((1000 / dur) * bytes);
                        // TODO: Check if the stream's size actually satifies the set size
                        if (media.bufferStream.finished) {
                            media.request = null;
                            media.setStatus(tasks_1.MediaStatus.FINISHED);
                            increaseBacklog();
                            media.outStream.write(utils_1.bufferConcat(media.buffers), decreaseBacklog);
                            media.buffers = [];
                            media.bufferedBytes = 0;
                            media.outStream.end();
                            media.outStream = null;
                            // FIXME: Tidy this up
                            const stream = media.getSource();
                            media.decreaseMirrorConn(stream);
                        }
                        else {
                            increaseBacklog();
                            media.outStream.write(utils_1.bufferConcat(media.buffers), decreaseBacklog);
                            media.bytes += bytes;
                            media.buffers = [];
                            media.bufferedBytes = 0;
                            media.lastUpdate = Date.now();
                        }
                    }
                }
            }
            // Serialize
            for (const task of tasks) {
                if (task.loaded) {
                    const serialized = serialize_1.serialize(task);
                    increaseBacklog();
                    fs.writeFile(task.metaFile, JSON.stringify(serialized), err => {
                        if (err) {
                            console.log("ANV: Error writing task metadata for #" + task.id + " - " + task.title);
                        }
                        else {
                            decreaseBacklog();
                        }
                    });
                }
            }
        }
        // Process queue
        queue_1.processQueue(mediaIds => {
            // FIXME: Do something here
        });
    }, (done) => {
        if (backlog === 0) {
            return done(null);
        }
        stop = done;
    });
    clock.start();
    return clock;
}
exports.clock = clock;
