import * as path from "path";
import * as fs from "fs";
import {Writable} from "stream";
import {parse as parseUrl} from "url";
import {type, bufferConcat} from "./utils";
import {Component, StateModel} from "lces";
import {
  Provider,
  Mirror,
  StreamResolver,
  MirrorResult,
  getFacet,
  getFacetById,
  getFacetByHost,
  facetStore,
  FacetStore,
} from "./facets";
import {rankItems} from "./tiers";
import {resolveProviderSource, resolveMirror} from "./resolve";
import {state, tmpState} from "./state";
import {queueAdd, advanceQueue, queueState, QueueState, queueFacetState, QueueFacet} from "./queue";
import {deepCopy} from "./utils";

const tasks: Task[] = [null];

// DEBUG
(<any> global).ANV.tasks = tasks;

export const crud = class {
  static getTask(id: number) {
    return tasks[id] || null;
  }

  static getTasks() {
    return tasks.filter(task => !!task);
  }

  static hasTaskThen(id: number, then: (task: Task) => void): Task {
    const task = this.getTask(id);

    if (task) then(task);
    return task;
  }

  static removeTask(id: number) {
    return this.hasTaskThen(id, task => {
      task.active = false;
      task.remove = true;
    });
  }

  static selectTaskMedia(id: number, list: Media[]) {
    return this.hasTaskThen(id, task => {
      task.active = true;
    });
  }

  static startTask(id: number) {
    return this.hasTaskThen(id, task => {
      task.active = true;
    });
  }

  static stopTask(id: number) {
    return this.hasTaskThen(id, task => {
      task.active = false;
    });
  }

  static deleteTaskMediaFile(id: number, media: number[]) {
    return this.hasTaskThen(id, task => {

    });
  }

  static resetTaskMedia(id: number, media: number[]) {
    return this.hasTaskThen(id, task => {

    });
  }

  // Media
  static getActiveMedia() {
    return mediaByStatus.ACTIVE;
  }

  static getPendingMedia() {
    return mediaByStatus.PENDING;
  }

  static getMediaSource(id: number) {
    return mediaSources[id] || null;
  }
}

export function getSimpleName(title: string) {
  return title.replace(/[^a-z\d\s\-,:'()@!]/ig, "").replace(/\s+/g, " ");
}

export function getInitials(title: string): string {
  title = title.toLowerCase().replace(/[^\sa-z\d]/ig, "");
  var words = title.split(" ").length;

  if (title.length < 5 || words === 1)
    return title.replace(/\s+/g, "").substr(0, 5).toUpperCase();
  else if (words === 2) {
    var split = title.split(" ");

    return (split[0].substr(0, 2) + split[1].substr(0, 2)).toUpperCase();
  } else if (words === 3) {
    return title.split(" ").map(s => s[0]).join("").toUpperCase();
  } else {
    var wordsFilter = title.split(" ").filter(s => s !== "no" && s !== "of" && s !== "the");

    if (wordsFilter.length < 4)
      return getInitials(wordsFilter.join(" "));
    else
      return wordsFilter.slice(0, 4).map(s => s[0]).join("").toUpperCase();
  }
}

export interface TaskEvents {
  load: boolean;
}

export
class Task extends Component<StateModel, TaskEvents> {
  id: number;
  url: string;
  title: string = "";
  cover: string = "";
  providerId: string;
  provider: string;
  list: Media[];
  active: boolean = false;
  remove: boolean = false; // Whether to remove this task on the next tick
  currentDl: number = 0;
  settings = deepCopy(state.task);
  dlDir: string;
  metaFile: string;
  loaded: boolean = false;
  finishedFromStart = 0; // FIXME: Find a better name

  constructor(
    url: string,
    list: Media[],
    providerId: string,
    provider: string,
  ) {
    super();

    this.url = url;

    this.id = tasks.length;
    tasks.push(this);

    this.providerId = providerId;
    this.provider = provider;

    this.list = list;

    // Create event
    this.newEvent("load");
  }
}

export const media: Media[] = [null];
export const mediaByStatus = {
  ACTIVE: <Media[]> [],
  PENDING: <Media[]> [],
};

export enum MediaStatus {
  IDLE = "IDLE",
  ACTIVE = "ACTIVE",
  PENDING = "PENDING",
  PAUSED = "PAUSED",
  FINISHED = "FINISHED",
};

// FIXME: Multiple terms for the same things
export const mediaSourceFacetMap = {
  direct: "provider",
  mirror: "mirror",
  stream: "streamresolver",
};

export interface MediaRequest {
  stop(): void;
  finished?: boolean;
}

export
class Media {
  id: number;
  listId: number;
  title: string;
  fileName: string;
  taskId: number;

  selected: boolean = true;
  status: MediaStatus = MediaStatus.IDLE;
  pendingBlocked: boolean = false;
  bytes: number = 0;
  size: number = null;
  sources: MediaSource[] = [];
  source: number = 0;
  sourceAttempts: number = 0;
  totalAttempts: number = 0;
  exhuastedSources: boolean = false;
  request: MediaRequest = null;
  streamData: {[k: string]: any} = {};
  emptyStreamData = true;

  streamResolver: StreamResolver = null;
  outStream: Writable;
  bufferStream: MediaStream;
  buffers: Buffer[] = [];
  bufferedBytes: number = 0; // Cleared every tick, used to calculate download speed
  lastUpdate: number = 0;
  speed: number = 0;

  queueId: number = null;
  queueFacet: keyof QueueFacet = null;
  queueFacetId: string;

  constructor(
    title: string,
    fileName: string,
    taskMediaList: Media[],
    taskId: number,
  ) {
    this.id = media.length;
    this.listId = taskMediaList.length;
    media.push(this);

    this.title = title;
    this.fileName = fileName;
    this.taskId = taskId;
  }

  setStatus(status: MediaStatus) {
    if (status !== this.status) {
      const task = this.getTask();

      const oldStatus = this.status;
      this.status = status;

      let compare = [oldStatus, status].map(status => {
        switch (status) {
          case MediaStatus.IDLE:
          case MediaStatus.PAUSED:
          case MediaStatus.FINISHED:
            return -1;
          case MediaStatus.PENDING:
          case MediaStatus.ACTIVE:
            return 1;
        }
      });

      // Compare old status to new status
      if (compare[0] !== compare[1]) {
        tmpState.currentDl += compare[1];
        task.currentDl += compare[1];
      }

      const oldStatusArray: Media[] = (<any> mediaByStatus)[oldStatus];
      const newStatusArray: Media[] = (<any> mediaByStatus)[status];

      if (oldStatusArray) {
        const index = oldStatusArray.indexOf(this);

        if (index !== -1) {
          oldStatusArray.splice(index, 1);
        }
      }

      if (newStatusArray) {
        newStatusArray.push(this);
      }
    }
  }

  start() {
    if (this.status !== MediaStatus.IDLE
        && this.status !== MediaStatus.PAUSED
        && this.status !== MediaStatus.PENDING) {
      return;
    }

    const source = this.getSource();

    // FIXME: This logic may be confusing
    if (this.queueId === null && this.status !== MediaStatus.PAUSED) {
      this.addQueue(source);
    } else {
      this.setStatus(MediaStatus.ACTIVE);
      this.resolveSource(source);
    }
  }

  addQueue(source: MediaSource) {
    let refSource = source;
    let streamChild = false;

    // Remap stream sources to their parents if any
    // TODO: DRY this
    if (source.type === MediaSourceType.Stream) {
      streamChild = true;

      if (source.parent) {
        refSource = crud.getMediaSource(source.parent);
      } else {
        // There's no parent, resolve this now
        return this.resolveSource(source);
      }
    }

    const facetType = <keyof FacetStore> mediaSourceFacetMap[refSource.type];
    const facet = getFacetById(facetType, refSource.facetId);

    const facetQueueMap = <{
      [facet: string]: string;
    }> {
      direct: "provider",
      mirror: "mirror",
    }

    // For stream sources' parents
    const streamQueueMap = <{
      [facet: string]: string;
    }> {
      direct: "providerstream",
      mirror: "mirrorstream",
    }

    const queueFacet = <keyof QueueFacet> (streamChild
                         ? streamQueueMap[refSource.type]
                         : facetQueueMap[refSource.type]);
    // Add to queue
    this.queueFacet = queueFacet;
    this.queueFacetId = facet.facetId;
    this.queueId = queueAdd(
      queueFacet,
      facet.facetId,
      null,
      this.id
    );

    this.setStatus(MediaStatus.PENDING);
  }

  stop(finished = false, done?: (err: string) => void) {
    if (this.status !== MediaStatus.ACTIVE && this.status !== MediaStatus.FINISHED) {
      return;
    }

    if (this.request) {
      try {
        this.request.stop();
      } catch (e) {
        // FIXME: Log this
      }

      this.request = null;
    }

    const hasOutstream = !!this.outStream;
    if (hasOutstream) {
      this.outStream.write(bufferConcat(this.buffers));
      this.outStream.end(() => {
        done && done(null);
      });

      this.outStream = null;
    }

    this.bytes += this.bufferedBytes;
    this.buffers = [];
    this.bufferedBytes = 0;

    // Prevent any further writes or modifications from a MediaStream
    this.totalAttempts++;

    if (this.status === MediaStatus.ACTIVE) {
      const stream = this.getSource();
      this.decreaseMirrorConn(stream);
    }

    // FIXME: This conditional doesn't account for most possibilities yet
    if (finished) {
      this.setStatus(MediaStatus.FINISHED);
    } else {
      this.setStatus(MediaStatus.PAUSED);
    }

    if (!hasOutstream && done) {
      setTimeout(() => {
        done(null);
      }, 0);
    }
  }

  nextSource() {
    // Reset stream data
    this.streamData = {};
    this.emptyStreamData = true;

    return ++this.source;
  }

  getSource() {
    return this.sources[this.source];
  }

  resolveSource(source: MediaSource) {
    const task = this.getTask();

    switch (source.type) {
      case "direct":
        resolveProviderSource(source.url, this.sources.length !== 1, (err, sources) => {
          if (err || !sources) {
            console.log("ANV Provider Error: ", err);
            this.reattemptSources();
          } else {
            const boxedSources = rankItems("provider", source.facet, sources, task.settings.tiers).map(resSource => {
              let box: MediaSource;

              switch (resSource.type) {
                case "mediasource":
                  const gresolver = getFacetByHost("provider", resSource.url);
                  box = new MediaSourceDirect(resSource.url, gresolver.name, gresolver.facetId);
                  break;

                case "mirror":
                  const mirror = getFacetByHost("mirror", resSource.url);

                  if (!mirror) {
                    console.error("ANV Error: No mirror found for: " + resSource.url);
                    return null;
                  }

                  box = new MediaSourceMirror(resSource.url, mirror.name, mirror.facetId);
                  break;

                case "stream":
                  // FIXME: Default stream resolver is probably a bug
                  const sresolver = getFacet("streamresolver", resSource.resolver || "basic");
                  box = new MediaSourceStream(resSource.url, sresolver.name, sresolver.facetId);
                  break;
              }

              box.parent = source.id;
              box.parentType = source.type;
              return box;
            }).filter(box => box !== null);

            this.sources.splice.apply(this.sources, [this.source + 1, 0].concat(<any>boxedSources));
            source.resolved = true;

            // Reresolve
            this.nextSource();
            const curSource = this.getSource();

            if (!curSource) {
              console.log("No sources for Media #" + this.id + " - " + this.fileName);
              return this.setStatus(MediaStatus.FINISHED);
            }

            this.addQueue(curSource);
          }
        });
        break;
      case "mirror":
        resolveMirror(source.url, (err, data) => {
          if (!data) {
            if (err) {
              console.error("ANV Mirror Error: " + err);
            }

            // Mirror says the this is a bad source
            this.setStatus(MediaStatus.PENDING);
            return this.reattemptSources(true);
          }

          const mirrorResult: MirrorResult = type(data) === "object" ? data : {
            url: data,
          };

          if (mirrorResult.type === "mirror") {
            const mirror = getFacetByHost("mirror", data.url);

            if (mirror) {
              // We have to reresolve this mirror
              const box = new MediaSourceMirror(data.url, mirror.name, mirror.facetId);
              this.sources.splice(this.source + 1, 0, box);

              box.parent = source.id;
              box.parentType = MediaSourceType.Mirror;

              this.nextSource();
              const curSource = this.getSource();
              this.addQueue(curSource);
            } else {
              // FIXME: ERROR
            }
          } else {
            // We have a direct stream
            const mirror = getFacetById("mirror", source.facetId);
            const sresolver = getFacet("streamresolver", mirror.streamResolver);

            const stream = new MediaSourceStream(mirrorResult.url, mirror.streamResolver, sresolver.facetId);
            stream.parent = source.id;
            stream.parentType = MediaSourceType.Mirror;

            if (type(mirrorResult.options) === "object")
              stream.options = mirrorResult.options;

            this.sources.splice(this.source + 1, 0, stream);
            source.resolved = true;

            // Reresolve
            this.nextSource();
            this.queueId = queueAdd("mirrorstream", mirror.facetId, null, this.id);
            this.queueFacet = "mirrorstream";
            this.queueFacetId = mirror.facetId;
            this.setStatus(MediaStatus.PENDING);
          }
        });
        break;
      case "stream":
        const parentSource = source.parent && crud.getMediaSource(source.parent);

        if (this.queueFacet !== "mirrorstream"
            && parentSource && parentSource.type === MediaSourceType.Mirror) {
          const mirror = getFacetById("mirror", parentSource.facetId);

          if (this.queueFacet === "mirrorstreamstart" && this.queueFacetId === mirror.facetId) {
            // Already queued
            if (queueState("mirrorstreamstart", mirror.facetId, this.queueId) === QueueState.READY) {
              // Ready
              this.startStream(<MediaSourceStream> source);
              mirror.lastStreamUse = Date.now();

              // Clear queue flags
              this.queueFacet = null;
              this.queueFacetId = null;
            }
          } else {
            // Have to queue this stream
            this.queueId = queueAdd("mirrorstreamstart", mirror.facetId, null, this.id);
            this.queueFacet = "mirrorstreamstart";
            this.queueFacetId = mirror.facetId;
            this.setStatus(MediaStatus.PENDING);
          }
        } else {
          // No suitable parent source to queue or queued for streaming, just start dl'ing now
          this.startStream(<MediaSourceStream> source);
        }

        break;
    }
  }

  // FIXME: Tidy this up
  reattemptSources(skip = false) {
    const media = this;
    const task = media.getTask();

    const attempt = ++media.totalAttempts;
    console.log("ANV Stream Error for source #" + media.source + " in Media #" + media.id + " - " + media.fileName);

    if (skip || media.sourceAttempts >= state.maxSourceRetries) {
      // Give up
      console.log(`Skipping bad source #${ media.source } (${ media.sources[media.source].url }) in Media #${ media.id } - ${ media.fileName }`);
      media.sourceAttempts = 0;

      // Remove connections for this source FIXME: This might be bad design
      this.decreaseMirrorConn(this.getSource());

      // Go to the next source
      this.nextSource();

      // Reset active media properties
      this.bytes = 0;
      this.bufferedBytes = 0;
      this.size = null;
      this.buffers = [];

      if (this.outStream) {
        this.pendingBlocked = true;

        this.outStream.end(() => {
          fs.writeFile(this.getFilePath(), Buffer.alloc(0), (err) => {
            if (!err) {
              // FIXME: Log the error somewhere
              this.pendingBlocked = false;
            }
          });
        });

        this.outStream = null;
      }

      const newSource = this.getSource();
      if (newSource) {
        // FIXME: Use queue here or smth
        setTimeout(() => {
          if (this.totalAttempts === attempt) {
            media.resolveSource(newSource);
          }

        }, 1000);
      } else {
        media.setStatus(MediaStatus.FINISHED);
        media.exhuastedSources = true;
        console.log(`Exhausted all sources for Media #${ media.id } - ${ media.fileName }`);
      }
    } else {
      // Try again
      media.sourceAttempts++;
      console.log(`Reattempt #${ media.sourceAttempts } for source #${ media.source } in Media #${ media.id } - ${ media.fileName }`);

      // FIXME: Use queue here or smth
      setTimeout(() => {
        media.resolveSource(this.getSource());
      }, 1000);
    }
  }

  decreaseMirrorConn(stream: MediaSourceStream) {
    if (stream.parentType === MediaSourceType.Mirror) {
      const mirror = mediaSources[stream.parent];
      const facet = getFacetById("mirror", mirror.facetId);

      // Mark mirror facet as done
      facet.connectionCount--;

      // Advance queue if nothing's actually changed
      // TODO: Find similar issues to this
      let mstream = queueFacetState("mirrorstream", facet.facetId);
      if (mstream && facet.connectionCount === mstream.state) {
        advanceQueue("mirrorstream", facet.facetId, false, true, true);
      }
    }
  }

  startStream(stream: MediaSourceStream) {
    let parentSource: Mirror;

    if (stream.parentType === MediaSourceType.Mirror) {
      if (!state.ignoreMaxConnections) {
        const parent = mediaSources[stream.parent];
        const facet = parentSource = getFacetById("mirror", parent.facetId);

        // Are there too many connections being used now?
        if (facet.maxConnections && facet.connectionCount >= facet.maxConnections) {
          // Can we skip and are there are any more sources to use? FIXME: Check the following sources aren't also the same mirror
          if (state.skipOccupiedMirrors && this.source + 1 < this.sources.length) {
            this.nextSource();

            const source = this.getSource();
            const facet = getFacetById(<keyof FacetStore> mediaSourceFacetMap[source.type], source.facetId);

            const streamFacetQueueMap = <{
              [facet: string]: string
            }> {
              // FIXME: No such thing as "providerstream"
              provider: "providerstream",
              mirror: "mirrorstream",
            };

            // Add to queue
            const queueFacet = <keyof QueueFacet> streamFacetQueueMap[source.type];
            this.queueFacet = queueFacet;
            this.queueFacetId = facet.facetId;
            this.queueId = queueAdd(queueFacet, facet.facetId, null, this.id);
            return this.setStatus(MediaStatus.PENDING);
          } else {
            // Just wait
            this.queueFacet = "mirrorstream";
            this.queueFacetId = facet.facetId;
            this.queueId = queueAdd("mirrorstream", facet.facetId, null, this.id);
            return this.setStatus(MediaStatus.PENDING);
          }
        }
      }
    }

    const sresolver: StreamResolver = this.streamResolver = getFacetById("streamresolver", stream.facetId);
    const task = this.getTask();

    if (!this.outStream && !sresolver.external) {
      this.outStream = fs.createWriteStream(this.getFilePath(), {
        flags: "a",
        encoding: "binary",
      });
    }

    if (this.emptyStreamData) {
      this.streamData = sresolver.streamData || {};
      this.emptyStreamData = false;
    }

    this.lastUpdate = Date.now();
    let error = false;

    if (sresolver.external) {
      // External stream resolver
      this.outStream = null;
      this.bufferStream = null;

      const attempt = this.totalAttempts;
      const media = this;

      function info({size, bytes, speed, finished}: {size: number, bytes: number, speed: number, finished: boolean}) {
        if (attempt === media.totalAttempts) {
          if (typeof size === "number") {
            media.size = size;
          }

          if (typeof bytes === "number") {
            media.bytes = bytes;
          }

          if (typeof speed === "number") {
            media.speed = speed;
          }

          if (finished) {
            media.stop(true);
          }
        }
      }

      try {
        this.request = sresolver.resolve(stream.url, this.bytes, this.getFilePath(), info, stream.options || {});
      } catch (e) {
        // FIXME: Error should be logged
        error = true;
      }
    } else {
      // Internal stream resolver
      const out = this.bufferStream = new MediaStream(this);

      try {
        this.request = sresolver.resolve(stream.url, this.bytes, out, null, stream.options || {});
      } catch (e) {
        // FIXME: Error should be logged
        error = true;
      }
    }

    sresolver.lastUse = Date.now();

    if (error) {
      // FIXME: This op can be async and should be tracked
      this.stop(false);
      this.setStatus(MediaStatus.ACTIVE);
      this.reattemptSources(true);
    } else {
      // Increase parent source connection count for connection throttling
      if (parentSource && !this.sourceAttempts) {
        parentSource.connectionCount++;
      }
    }
  }

  getTask() {
    return crud.getTask(this.taskId);
  }

  getFilePath() {
    return this.getTask().dlDir + path.sep + this.fileName;
  }
}

export
class MediaStream extends Writable {
  mediaAttempt: number;
  finished = false;

  constructor(
    public media: Media,
  ) {
    super({});

    this.mediaAttempt = media.totalAttempts;
  }

  setSize(size: number) {
    if (this.mediaAttempt === this.media.totalAttempts && !this.media.size) {
      this.media.size = size;
    }
  }

  setStreamData(data: Media["streamData"]) {
    if (this.mediaAttempt === this.media.totalAttempts && type(data) === "object") {
      this.media.streamData = data;
    }
  }

  getStreamData(): Media["streamData"] {
    return this.media.streamData;
  }

  getAccumBytes(): number {
    return this.media.bytes;
  }

  error(err: any) {
    // FIXME: Report err

    if (this.mediaAttempt === this.media.totalAttempts) {
      this.end();
      this.media.reattemptSources();
    }
  }

  _write(chunk: Buffer, encoding: string, callback: (err?: Error) => void) {
    if (this.mediaAttempt === this.media.totalAttempts) {
      this.media.buffers.push(chunk);
      this.media.bufferedBytes += chunk.length;
    }

    // FIXME: Maybe some checks here, maybe not
    callback();
  }

  _final(callback: (err?: Error) => void) {
    // TODO: Wrap up things with our Media
    callback();

    this.finished = true;
  }
}

export const mediaSources: MediaSource[] = [null];

export enum MediaSourceType {
  Direct = "direct",
  Mirror = "mirror",
  Stream = "stream",
};

export class MediaSource {
  id: number;
  type: MediaSourceType;
  facet: string;
  facetId: string;
  facetType: string;
  url: string;
  parent: number = null;
  parentType: MediaSourceType = null;
  resolved: boolean = false;
  options: {
    [option: string]: any;
  } = {};

  constructor() {
    this.id = mediaSources.length;
    mediaSources.push(this);
  }
}

export
class MediaSourceStream extends MediaSource {
  constructor(
    public url: string,
    public facet: string,
    public facetId: string, // Stream Resolver ID
  ) {
  super();
    this.type = MediaSourceType.Stream;
    this.facetType = "streamresolver";
  }
}

export
class MediaSourceMirror extends MediaSource {
  constructor(
    public url: string,
    public facet: string,
    public facetId: string, // Mirror ID
    public sourceStream: MediaSourceStream = null,
  ) {
    super();
    this.type = MediaSourceType.Mirror;
    this.facetType = "mirror";
  }
}

export
class MediaSourceDirect extends MediaSource {
  constructor(
    public url: string,
    public facet: string,
    public facetId: string, // Provider ID
  ) {
    super();
    this.type = MediaSourceType.Direct;
    this.facetType = "provider";
  }
}
