import {state, tmpState} from "./state";
import {Task, MediaStatus, MediaSourceType} from "./tasks";
import {startTick} from "./tick";
import {getFacet} from "./facets";

interface DelayMap {
  facet: {
    [facet: string]: number;
  }
  media: {
    [mediaId: string]: {
      delay: boolean,
      facet: {
        lastUse?: number,
      }
    };
  }
}

const mediaFacetMap = {
  [MediaSourceType.Direct]: "provider",
  [MediaSourceType.Mirror]: "mirror",
  [MediaSourceType.Stream]: "streamresolver",
}

function taskPendingCount(task: Task, delayMap: DelayMap): number {
  return task.list.filter(m => {
    const eligible = m.selected && m.status !== MediaStatus.FINISHED && m.status !== MediaStatus.ACTIVE;

    if (eligible) {
      if (delayMap.media.hasOwnProperty(m.id)) {
        return delayMap.media[m.id].delay;
      }

      const source = m.sources[m.source];
      const facetType = mediaFacetMap[source.type];
      const facet = getFacet(<"provider" | "mirror" | "streamresolver"> facetType, source.facet);
      const facetIdPrefix = facetType + ":" + facet.facetId;

      const lastUse = facetIdPrefix in delayMap.facet ? delayMap.facet[facetIdPrefix] : facet.lastUse;

      if (!(facetIdPrefix in delayMap.facet)) {
        delayMap.facet[facetIdPrefix] = Date.now();
      }

      delayMap.media[m.id] = {
        delay: (Date.now() - lastUse) > (<any> facet).delay,
        facet,
      }

      return delayMap.media[m.id].delay;
    }
  }).length;
}

export function clock() {
  const clock = startTick([50, state.tickDelay, 2000], (tasks, intervals) => {
    const delayMap: DelayMap = {
      media: {},
      facet: {},
    };
    let exhaustedTasks = false;

    function addMoreMedia(tasks: Task[], limit: number) {
      for (const task of tasks) {
        if (task.active) {
          mediaLoop:
          for (const media of task.list) {
            if (media.selected && (media.status === MediaStatus.IDLE || media.status === MediaStatus.PAUSED)) {
              media.start();
              tmpState.currentDl++;

              limit--;
              break mediaLoop;
            }
          }

          if (task.currentDl < taskPendingCount(task, delayMap)) {
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
        while (!exhaustedTasks && task.currentDl < state.maxConcurrentDl && taskPendingCount(task, delayMap)) {
          exhaustedTasks = true;
          addMoreMedia([task], 1);
        }
      }

      if (intervals[state.tickDelay]) {
        for (const media of task.list) {
          if (media.status === MediaStatus.ACTIVE && media.outStream && media.request) {
              const now = Date.now();
              const dur = now - media.lastUpdate;
              const bytes = media.bufferedBytes;

              media.speed = Math.floor((1000 / dur) * bytes);

            if (media.bytes === media.size) {
                media.request = null;
                media.status = MediaStatus.FINISHED;
                media.outStream.write(media.buffer);

                media.buffer = Buffer.alloc(0);
                media.bufferedBytes = 0;
                media.outStream.end();

                task.currentDl--;
                tmpState.currentDl--;
            } else {
              media.outStream.write(media.buffer);
              media.bytes += bytes;
              media.buffer = Buffer.alloc(0);
              media.bufferedBytes = 0;
            }
          }
        }
      }
    }
  });

  clock.start();
  return clock;
}
