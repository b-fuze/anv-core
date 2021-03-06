import * as fs from "fs";
import {bufferConcat} from "./utils";
import {state, tmpState} from "./state";
import {Task, crud, mediaSources, MediaStatus, MediaSourceType} from "./tasks";
import {startTick} from "./tick";
import {getFacet, getFacetById} from "./facets";
import {advanceQueue, processQueue, queueState, QueueState} from "./queue";
import {serialize} from "./serialize";

function taskActiveCount(task: Task) {
  return task.list.filter(m => (m.selected && m.status === MediaStatus.ACTIVE)).length;
}

function taskFinishedCount(task: Task) {
  return Math.max(task.list.filter(m => (m.selected && m.status === MediaStatus.FINISHED)).length - task.finishedFromStart, 0);
}

function getTasksByFairness(tasks: Task[]) {
  return (state.taskFairness
          ? tasks.slice().sort((a, b) => (taskFinishedCount(a) - taskFinishedCount(b)) + (taskActiveCount(a) - taskActiveCount(b)))
          : tasks.slice());
}

// FIXME: Unnecessary term clash made this a requirement
const sourceQueueMap = {
  direct: "provider",
  mirror: "mirror",
};

function exhuastedConcurrent(task: Task, activeMedia: number, setActive: number) {
  return (state.maxGlobalConcurrentDl
          && tmpState.currentDl >= state.maxGlobalConcurrentDl
          && activeMedia === task.currentDl
          || !state.maxGlobalConcurrentDl
             && activeMedia >= state.maxConcurrentDl);
}

export function clock() {
  let stop: (err: string) => void;
  let backlog = 0;

  function increaseBacklog() {
    backlog++;
  }

  function decreaseBacklog() {
    backlog--;

    if (backlog === 0 && stop) {
      stop(null);
    }
  }

  const clock = startTick([50, state.tickDelay, 2000], (tasks, intervals) => {
    let available = state.maxGlobalConcurrentDl
                    ? state.maxGlobalConcurrentDl - tmpState.currentDl
                    : 1;
    let oldAvailable = available;
    let iterations = 0;

    // Add new media
    while (!iterations || available > 0 && !(iterations && oldAvailable === available)) {
      oldAvailable = available;

      taskLoop:
      for (const task of getTasksByFairness(tasks)) {
        if (!task.active) {
          continue taskLoop;
        }

        let activeMedia = 0;
        let setActive = 0;

        mediaLoop:
        for (const media of task.list) {
          if (media.selected) {
            if (media.status !== MediaStatus.FINISHED) {
              if (media.status === MediaStatus.IDLE || media.status === MediaStatus.PAUSED) {
                if (!exhuastedConcurrent(task, activeMedia, setActive)) {
                  media.start();
                  setActive++;

                  if (!state.maxGlobalConcurrentDl) {
                    available--;
                  }
                }
              }

              if (media.status === MediaStatus.ACTIVE || media.status === MediaStatus.PENDING) {
                activeMedia++;
              }

              if (state.taskFairness && setActive) {
                break mediaLoop;
              }

              if (exhuastedConcurrent(task, activeMedia, setActive)) {
                break mediaLoop;
              }
            }
          }
        }
      }

      iterations++;
    }

    // Iterate pending media
    for (const media of crud.getPendingMedia()) {
      if (media.pendingBlocked) {
        continue;
      }

      let mediaSource = media.getSource();

      // Get parent mirror facet if any
      if (mediaSource.type === "stream" && mediaSource.parentType === "mirror") {
        mediaSource = crud.getMediaSource(mediaSource.parent);
      }

      const queueFacet = media.queueFacet;
      const queueId = media.queueId;

      if (queueState(queueFacet, mediaSource.facetId, media.queueId) === QueueState.READY) {
        // Media is ready in queue
        media.start();
        advanceQueue(queueFacet, mediaSource.facetId, true, true);
      }
    }

    if (intervals[state.tickDelay]) {
      // Iterate active media
      for (const media of crud.getActiveMedia()) {
        if (media.request) {
          if (!media.streamResolver.external && media.outStream) {
            // The stream resolver is internal, proceed to calculate speed, etc
            const now = Date.now();
            const dur = now - media.lastUpdate;
            const bytes = media.bufferedBytes;

            media.speed = Math.floor((1000 / dur) * bytes);

            // TODO: Check if the stream's size actually satifies the set size
            if (media.bufferStream.finished) {
              media.request = null;
              media.setStatus(MediaStatus.FINISHED);

              increaseBacklog();
              media.outStream.write(bufferConcat(media.buffers), decreaseBacklog);

              media.buffers = [];
              media.bufferedBytes = 0;
              media.outStream.end();
              media.outStream = null;

              // FIXME: Tidy this up
              const stream = media.getSource();
              media.decreaseMirrorConn(stream);
            } else {
              increaseBacklog();
              media.outStream.write(bufferConcat(media.buffers), decreaseBacklog);

              media.bytes += bytes;
              media.buffers = [];
              media.bufferedBytes = 0;
              media.lastUpdate = Date.now();
            }
          }
        }
      }

      // Serialize
      for (const task of tasks) {
        if (task.loaded) {
          const serialized = serialize(task);
          increaseBacklog();

          fs.writeFile(task.metaFile, JSON.stringify(serialized), err => {
            if (err) {
              console.log("ANV: Error writing task metadata for #" + task.id + " - " + task.title);
            } else {
              decreaseBacklog();
            }
          });
        }
      }
    }

    // Process queue
    processQueue(mediaIds => {
      // FIXME: Do something here
    });
  }, (done) => {
    if (backlog === 0) {
      return done(null);
    }

    stop = done;
  });

  clock.start();
  return clock;
}
