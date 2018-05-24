import {Task} from "./tasks";

export interface Tick {
  interval: number;
  tickId: NodeJS.Timer;
  tasks: Task[];
  ticking: boolean;

  tick(this: Tick): void;
  start(this: Tick): void;
  stop(this: Tick): void;
}

export function startTick(tasks: Task[], interval = 1000): Tick {
  const tickData: Tick = {
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

function tickIteration(tasks: Task[]) {
  for (const task of tasks) {
    
  }
}
