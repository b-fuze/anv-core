"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function startTick(tasks, interval = 1000) {
    const tickData = {
        interval,
        tickId: null,
        tasks: tasks,
        ticking: true,
        tick() {
            tickIteration(this.tasks);
        },
        start() {
            this.stop();
            this.ticking = true;
            this.tickId = setInterval(() => {
                this.tick();
            }, this.interval);
        },
        stop() {
            this.ticking = false;
            clearInterval(this.tickId);
        },
    };
    return tickData;
}
exports.startTick = startTick;
function tickIteration(tasks) {
    for (const task of tasks) {
    }
}
