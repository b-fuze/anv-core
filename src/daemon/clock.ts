import {state, tmpState} from "./state";
import {Task, MediaStatus} from "./tasks";
import {startTick} from "./tick";

export function clock() {
  const clock = startTick([50, state.tickDelay], (tasks, intervals) => {
    let exhaustedTasks = false;

    function addMoreMedia(tasks: Task[], limit: number) {
      for (const task of tasks) {
        if (task.active) {
          for (const media of task.list) {
            if (media.selected && (media.status === MediaStatus.IDLE || media.status === MediaStatus.PAUSED)) {
              media.start();
              tmpState.currentDl++;

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

    while (!exhaustedTasks && state.maxGlobalConcurrentDl && tmpState.currentDl < state.maxGlobalConcurrentDl) {
      exhaustedTasks = true;
      addMoreMedia(tasks, state.maxGlobalConcurrentDl - tmpState.currentDl);
    }

    for (const task of tasks) {
      if (!exhaustedTasks && !state.maxGlobalConcurrentDl && !state.limitOnlyGlobal) {
        while (!exhaustedTasks && task.currentDl < task.list.filter(m => m.selected).length) {
          exhaustedTasks = true;
          addMoreMedia([task], 1);
        }
      }

      if (intervals[state.tickDelay]) {

      }
    }
  });

  clock.start();
  return clock;
}
