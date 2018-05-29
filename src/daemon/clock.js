"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const state_1 = require("./state");
const tasks_1 = require("./tasks");
const tick_1 = require("./tick");
function clock() {
    const clock = tick_1.startTick([50, state_1.state.tickDelay], (tasks, intervals) => {
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
                    if (task.currentDl < task.list.filter(m => m.selected).length) {
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
                while (!exhaustedTasks && task.currentDl < task.list.filter(m => m.selected).length) {
                    exhaustedTasks = true;
                    addMoreMedia([task], 1);
                }
            }
            if (intervals[state_1.state.tickDelay]) {
            }
        }
    });
    clock.start();
    return clock;
}
exports.clock = clock;
