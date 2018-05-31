"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const state_1 = require("./state");
const tasks_1 = require("./tasks");
const tick_1 = require("./tick");
function taskPendingCount(task) {
    return task.list.filter(m => m.selected && m.status !== tasks_1.MediaStatus.FINISHED).length;
}
function clock() {
    const clock = tick_1.startTick([50, state_1.state.tickDelay, 2000], (tasks, intervals) => {
        let exhaustedTasks = false;
        function addMoreMedia(tasks, limit) {
            for (const task of tasks) {
                if (task.active) {
                    for (const media of task.list) {
                        if (media.selected && (media.status === tasks_1.MediaStatus.IDLE || media.status === tasks_1.MediaStatus.PAUSED)) {
                            media.start();
                            state_1.tmpState.currentDl++;
                            limit--;
                            break;
                        }
                    }
                    if (task.currentDl < taskPendingCount(task)) {
                        exhaustedTasks = false;
                    }
                    if (!limit) {
                        return;
                    }
                }
            }
        }
        while (!exhaustedTasks && state_1.state.maxGlobalConcurrentDl && state_1.tmpState.currentDl < state_1.state.maxGlobalConcurrentDl) {
            exhaustedTasks = true;
            addMoreMedia(tasks, state_1.state.maxGlobalConcurrentDl - state_1.tmpState.currentDl);
        }
        for (const task of tasks) {
            if (!exhaustedTasks && !state_1.state.maxGlobalConcurrentDl && !state_1.state.limitOnlyGlobal) {
                while (!exhaustedTasks && task.currentDl < taskPendingCount(task)) {
                    exhaustedTasks = true;
                    addMoreMedia([task], 1);
                }
            }
            if (intervals[state_1.state.tickDelay]) {
            }
            if (intervals[2000]) {
            }
        }
    });
    clock.start();
    return clock;
}
exports.clock = clock;
