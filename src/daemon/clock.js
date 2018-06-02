"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
const state_1 = require("./state");
const tasks_1 = require("./tasks");
const tick_1 = require("./tick");
const facets_1 = require("./facets");
const mediaFacetMap = {
    [tasks_1.MediaSourceType.Direct]: "provider",
    [tasks_1.MediaSourceType.Mirror]: "mirror",
    [tasks_1.MediaSourceType.Stream]: "streamresolver",
};
function taskActiveCount(task) {
    return task.list.filter(m => (m.status === tasks_1.MediaStatus.ACTIVE)).length;
}
function taskFinishedCount(task) {
    return task.list.filter(m => (m.status === tasks_1.MediaStatus.FINISHED)).length;
}
function getTasksByFairness(tasks) {
    return (state_1.state.taskFairness
        ? tasks.slice().sort((a, b) => (taskFinishedCount(a) - taskFinishedCount(b)) + (taskActiveCount(a) - taskActiveCount(b)))
        : tasks.slice());
}
function taskPendingCount(task, delayMap) {
    return task.list.filter(m => {
        const eligible = m.selected && m.status !== tasks_1.MediaStatus.FINISHED && m.status !== tasks_1.MediaStatus.ACTIVE;
        if (eligible) {
            let oldValue = null;
            if (delayMap.media.hasOwnProperty(m.id)) {
                oldValue = delayMap.media[m.id].delay;
            }
            const source = m.sources[m.source];
            const facetType = mediaFacetMap[source.type];
            const facet = facets_1.getFacet(facetType, source.facet);
            const facetIdPrefix = facetType + ":" + facet.facetId;
            const lastUse = facetIdPrefix in delayMap.facet ? delayMap.facet[facetIdPrefix] : facet.lastUse;
            if (!(facetIdPrefix in delayMap.facet)) {
                delayMap.facet[facetIdPrefix] = Date.now();
            }
            delayMap.media[m.id] = {
                delay: oldValue !== null && !oldValue ? oldValue : (Date.now() - lastUse) > facet.delay,
                facet,
            };
            return delayMap.media[m.id].delay;
        }
    }).length;
}
function clock() {
    const clock = tick_1.startTick([50, state_1.state.tickDelay, 2000], (tasks, intervals) => {
        const delayMap = {
            media: {},
            facet: {},
        };
        let exhaustedTasks = false;
        function addMoreMedia(tasks, limit) {
            taskLoop: for (const task of tasks) {
                taskPendingCount(task, delayMap);
                if (task.active) {
                    mediaLoop: for (const media of task.list) {
                        if (media.selected) {
                            if (media.status !== tasks_1.MediaStatus.FINISHED
                                && media.status !== tasks_1.MediaStatus.ACTIVE
                                && delayMap.media[media.id].delay) {
                                media.start();
                                limit--;
                                break mediaLoop;
                            }
                            else if (media.status === tasks_1.MediaStatus.PENDING) {
                                limit--;
                            }
                        }
                        if (!limit) {
                            continue taskLoop;
                        }
                    }
                    if (task.currentDl < taskPendingCount(task, delayMap)) {
                        exhaustedTasks = false;
                    }
                }
            }
        }
        while (!exhaustedTasks && state_1.state.maxGlobalConcurrentDl && state_1.tmpState.currentDl < state_1.state.maxGlobalConcurrentDl) {
            exhaustedTasks = true;
            addMoreMedia(getTasksByFairness(tasks), state_1.state.maxGlobalConcurrentDl - state_1.tmpState.currentDl);
        }
        for (const task of getTasksByFairness(tasks)) {
            if (!exhaustedTasks && !state_1.state.maxGlobalConcurrentDl && !state_1.state.limitOnlyGlobal) {
                while (!exhaustedTasks && task.currentDl < state_1.state.maxConcurrentDl && taskPendingCount(task, delayMap)) {
                    exhaustedTasks = true;
                    addMoreMedia([task], 1);
                }
            }
            if (intervals[state_1.state.tickDelay]) {
                for (const media of task.list) {
                    if (media.status === tasks_1.MediaStatus.ACTIVE && media.outStream && media.request) {
                        const now = Date.now();
                        const dur = now - media.lastUpdate;
                        const bytes = media.bufferedBytes;
                        media.speed = Math.floor((1000 / dur) * bytes);
                        if (media.bytes === media.size) {
                            media.request = null;
                            media.setStatus(tasks_1.MediaStatus.FINISHED);
                            media.outStream.write(utils_1.bufferConcat(media.buffers));
                            media.buffers = [];
                            media.bufferedBytes = 0;
                            media.outStream.end();
                        }
                        else {
                            media.outStream.write(utils_1.bufferConcat(media.buffers));
                            media.bytes += bytes;
                            media.buffers = [];
                            media.bufferedBytes = 0;
                            media.lastUpdate = Date.now();
                        }
                    }
                }
            }
        }
    });
    clock.start();
    return clock;
}
exports.clock = clock;
