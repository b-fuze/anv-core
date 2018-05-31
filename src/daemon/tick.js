"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tasks_1 = require("./tasks");
const lces_1 = require("lces");
function startTick(intervals = [1000], callback) {
    const intervalsSorted = Array.from(new Set(intervals)).sort((a, b) => a - b);
    const event = new lces_1.Component();
    event.newEvent("tick");
    const tickData = {
        smallestInterval: intervalsSorted[0],
        intervals: intervalsSorted,
        intervalsIterations: intervalsSorted.map(i => -1),
        startTime: Date.now(),
        tickId: null,
        ticking: true,
        event,
        tick() {
            // Check if each larger interval has passed
            const startTime = this.startTime;
            const totalTime = Date.now() - startTime;
            const intervalFlags = {
                [this.smallestInterval]: true,
            };
            for (let i = 1; i < this.intervals.length; i++) {
                const interval = this.intervals[i];
                const lastTime = this.intervalsIterations[i];
                const times = Math.floor(totalTime / interval);
                intervalFlags[interval] = times > lastTime;
                this.intervalsIterations[i] = times;
            }
            callback(tasks_1.crud.getTasks(), intervalFlags);
            event.triggerEvent("tick", intervalFlags);
        },
        start() {
            this.stop();
            this.ticking = true;
            this.tickId = setInterval(() => {
                this.tick();
            }, this.smallestInterval);
        },
        stop() {
            this.ticking = false;
            clearInterval(this.tickId);
        },
    };
    return tickData;
}
exports.startTick = startTick;
