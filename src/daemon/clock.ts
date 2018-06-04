import {bufferConcat} from "./utils";
import {state, tmpState} from "./state";
import {Task, mediaSources, MediaStatus, MediaSourceType} from "./tasks";
import {startTick} from "./tick";
import {getFacet, getFacetById} from "./facets";
import {advanceQueue, processQueue, queueState, QueueState} from "./queue";

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

// FIXME: Unnecessary term clash made this a requirement
const sourceQueueMap = {
  direct: "provider",
  mirror: "mirror",
};

function taskActiveCount(task: Task) {
  return task.list.filter(m => (m.status === MediaStatus.ACTIVE)).length;
}

function taskFinishedCount(task: Task) {
  return task.list.filter(m => (m.status === MediaStatus.FINISHED)).length;
}

function getTasksByFairness(tasks: Task[]) {
  return (state.taskFairness
                  ? tasks.slice().sort((a, b) => (taskFinishedCount(a) - taskFinishedCount(b)) + (taskActiveCount(a) - taskActiveCount(b)))
                  : tasks.slice());
}

function taskPendingCount(task: Task, delayMap?: DelayMap): number {
  return task.list.filter(m => {
    const eligible = m.selected && m.status !== MediaStatus.FINISHED && m.status !== MediaStatus.ACTIVE;

    if (eligible) {
      if (m.queueId === null) {
        // This media hasn't even been queued yet
        return true;
      } else {
        let source = m.getSource();
        let mirrorStream = false;

        if (source.type === "stream" && source.parentType === "mirror") {
          source = mediaSources[source.parent];
          mirrorStream = true;
        }

        return queueState(<any> (mirrorStream ? "mirrorstream" : (<any> sourceQueueMap)[source.type]), source.facetId, m.queueId) === QueueState.READY;
      }
    }
  }).length;
}

export function clock() {
  const clock = startTick([50, state.tickDelay, 2000], (tasks, intervals) => {
    let exhaustedTasks = false;

    function addMoreMedia(tasks: Task[], limit: number) {
      taskLoop:
      for (const task of tasks) {
        if (task.active) {
          mediaLoop:
          for (const media of task.list) {
            if (media.selected) {
              let mediaSource = media.getSource();
              let mirrorStream = false;

              if (mediaSource.type === "stream" && mediaSource.parentType === "mirror") {
                mediaSource = mediaSources[mediaSource.parent];
                mirrorStream = true;
              }

              const queueFacet = <any> (mirrorStream ? "mirrorstream" : (<any> sourceQueueMap)[mediaSource.type]);

              if (media.status !== MediaStatus.FINISHED
                  && media.status !== MediaStatus.ACTIVE
                  && (media.queueId === null
                      || mediaSource.type === "stream"
                      || queueState(queueFacet, mediaSource.facetId, media.queueId) === QueueState.READY)) {
                media.start();

                if (media.queueId !== null) {
                  advanceQueue(queueFacet, mediaSource.facetId);
                }

                limit--;
                break mediaLoop;
              } else if (media.status === MediaStatus.PENDING) {
                limit--;
              }
            }

            if (!limit) {
              continue taskLoop;
            }
          }

          if (task.currentDl < taskPendingCount(task)) {
            exhaustedTasks = false;
          }
        }
      }
    }

    while (!exhaustedTasks && state.maxGlobalConcurrentDl && tmpState.currentDl < state.maxGlobalConcurrentDl) {
      exhaustedTasks = true;
      addMoreMedia(getTasksByFairness(tasks), state.maxGlobalConcurrentDl - tmpState.currentDl);
    }

    for (const task of getTasksByFairness(tasks)) {
      if (!exhaustedTasks && !state.maxGlobalConcurrentDl && !state.limitOnlyGlobal) {
        while (!exhaustedTasks && task.currentDl < state.maxConcurrentDl && taskPendingCount(task)) {
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
                media.setStatus(MediaStatus.FINISHED);
                media.outStream.write(bufferConcat(media.buffers));

                media.buffers = [];
                media.bufferedBytes = 0;
                media.outStream.end();

                // FIXME: Tidy this up
                const stream = media.getSource();
                if (stream.parentType === MediaSourceType.Mirror) {
                  const mirror = mediaSources[stream.parent];
                  const facet = getFacetById("mirror", mirror.facetId);

                  // Mark mirror facet as done
                  facet.connectionCount--;
                }
            } else {
              media.outStream.write(bufferConcat(media.buffers));
              media.bytes += bytes;
              media.buffers = [];
              media.bufferedBytes = 0;
              media.lastUpdate = Date.now();
            }
          }
        }
      }
    }

    // Process queue
    processQueue(mediaIds => {
      // FIXME: Do something here
    });
  });

  clock.start();
  return clock;
}
