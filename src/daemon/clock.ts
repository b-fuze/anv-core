import {state, tmpState} from "./state";
import {Task, MediaStatus} from "./tasks";
import {startTick} from "./tick";

function taskPendingCount(task: Task): number {
  return task.list.filter(m => m.selected && m.status !== MediaStatus.FINISHED).length
}

export function clock() {
  const clock = startTick([50, state.tickDelay, 2000], (tasks, intervals) => {
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

          if (task.currentDl < taskPendingCount(task)) {
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
        while (!exhaustedTasks && task.currentDl < taskPendingCount(task)) {
          exhaustedTasks = true;
          addMoreMedia([task], 1);
        }
      }

      if (intervals[state.tickDelay]) {

      }

      if (intervals[2000]) {
        
      }
    }
  });

  clock.start();
  return clock;
}
