import {Task, crud} from "./tasks";
import {Component, StateModel} from "lces";

export interface Tick {
  smallestInterval: number;
  intervals: number[];
  intervalsIterations: number[];
  startTime: number;
  tickId: NodeJS.Timer;
  ticking: boolean;
  event: Component<StateModel, TickEvent>;

  tick(this: Tick): void;
  start(this: Tick): void;
  stop(this: Tick): void;
}

export interface TickIntervalFlags {
  [interval: string]: boolean;
}

export interface TickEvent {
  tick: TickIntervalFlags;
}

export function startTick(intervals = [1000], callback: (tasks: Task[], intervals: TickIntervalFlags) => void): Tick {
  const intervalsSorted = Array.from(new Set(intervals)).sort((a, b) => a - b);

  const event = new Component<StateModel, TickEvent>();
  event.newEvent("tick");

  const tickData: Tick = {
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
      const intervalFlags: TickIntervalFlags = {
        [this.smallestInterval]: true,
      };

      for (let i=1; i<this.intervals.length; i++) {
        const interval = this.intervals[i];
        const lastTime = this.intervalsIterations[i];
        const times = Math.floor(totalTime / interval);

        intervalFlags[interval] = times > lastTime;
        this.intervalsIterations[i] = times;
      }

      callback(crud.getTasks(), intervalFlags);
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
