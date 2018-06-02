import * as path from "path";
import * as fs from "fs";
import {Writable} from "stream";
import {parse as parseUrl} from "url";
import {type} from "./utils";
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
import {deepCopy} from "./utils";

const tasks: Task[] = [];

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
  loaded: boolean = false;

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

export const media: Media[] = [];

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
  bytes: number = 0;
  size: number = null;
  sources: MediaSource[] = [];
  source: number = 0;
  sourceAttempts: number = 0;
  totalAttempts: number = 0;
  exhuastedSources: boolean = false;
  request: MediaRequest = null;

  outStream: Writable;
  buffer: Buffer = Buffer.alloc(0);
  bufferedBytes: number = 0; // Cleared every tick, used to calculate download speed
  lastUpdate: number = 0;
  speed: number = 0;

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
      this.status = status;

      switch (status) {
        case MediaStatus.IDLE:
        case MediaStatus.PAUSED:
        case MediaStatus.PENDING:
        case MediaStatus.FINISHED:
          task.currentDl--;
          tmpState.currentDl--;
          break;
        case MediaStatus.ACTIVE:
          task.currentDl++;
          tmpState.currentDl++;
          break;
      }
    }
  }

  start() {
    if (this.status !== MediaStatus.IDLE
        && this.status !== MediaStatus.PAUSED
        && this.status !== MediaStatus.PENDING) {
      return;
    }

    this.setStatus(MediaStatus.ACTIVE);

    const source = this.sources[this.source];

    this.resolveSource(source);
  }

  stop(finished = false) {
    if (this.status !== MediaStatus.ACTIVE && this.status !== MediaStatus.FINISHED) {
      return;
    }

    if (this.request) {
      this.request.stop();
      this.request = null;
    }

    this.setStatus(MediaStatus.PAUSED);
  }

  resolveSource(source: MediaSource) {
    const task = this.getTask();

    switch (source.type) {
      case "direct":
        resolveProviderSource(source.url, this.sources.length !== 1, (err, sources) => {
          if (err) {
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
                  box = new MediaSourceMirror(resSource.url, mirror.name, mirror.facetId);
                  break;

                case "stream":
                  // FIXME: Default stream resolver is probably a bug
                  const sresolver = getFacet("streamresolver", resSource.resolver || "basic");
                  box = new MediaSourceStream(resSource.url, sresolver.name, sresolver.facetId);
                  break;
              }

              box.parent = source.id;
              return box;
            });

            this.sources.splice.apply(this.sources, [this.source + 1, 0].concat(<any>boxedSources));
            source.resolved = true;

            // Reresolve
            this.source++;

            const curSource = this.sources[this.source];
            const facet = getFacetById(<keyof FacetStore> mediaSourceFacetMap[curSource.type], curSource.facetId);

            if (!(<any> facet).delay || (Date.now() - facet.lastUse) > (<any> facet).delay) {
              if (mediaSourceFacetMap[curSource.type] === "mirror") {
                console.log("RES MEDIA #" + this.id, " delay:" + (<any>facet).delay + " lastUse:" + (Date.now() - facet.lastUse));
              }
              // We can use this source now
              this.resolveSource(curSource);
            } else {
              // We have to wait a while for this source
              this.setStatus(MediaStatus.PENDING);
            }
          }
        });
        break;
      case "mirror":
        resolveMirror(source.url, (err, data) => {
          if (!data) {
            // Mirror says the this is a bad source
            this.setStatus(MediaStatus.PENDING);
            return this.reattemptSources(true);
          }

          const mirror = getFacetById("mirror", source.facetId);
          const sresolver = getFacet("streamresolver", mirror.streamResolver);

          const mirrorResult: MirrorResult = type(data) === "object" ? data : {
            url: data,
          };

          const stream = new MediaSourceStream(mirrorResult.url, mirror.streamResolver, sresolver.facetId);
          stream.parent = source.id;

          if (type(mirrorResult.options) === "object")
            stream.options = mirrorResult.options;

          this.sources.splice(this.source + 1, 0, stream);
          source.resolved = true;

          // Reresolve
          this.source++;
          this.resolveSource(this.sources[this.source]);
        });
        break;
      case "stream":
        this.startStream(<MediaSourceStream> source);
        break;
    }
  }

  // FIXME: Tidy this up
  reattemptSources(skip = false) {
    const media = this;
    const task = media.getTask();

    media.totalAttempts++;
    console.log("ANV Stream Error for source #" + media.source + " in Media #" + media.id + " - " + media.fileName);

    if (skip || media.sourceAttempts >= state.maxSourceRetries) {
      // Give up
      console.log(`Skipping bad source #${ media.source } (${ media.sources[media.source].url }) in Media #${ media.id } - ${ media.fileName }`);
      media.sourceAttempts = 0;
      media.source++;

      if (media.sources[media.source]) {
        media.resolveSource(media.sources[media.source]);
      } else {
        media.setStatus(MediaStatus.FINISHED);
        media.exhuastedSources = true;
        console.log(`Exhausted all sources for Media #${ media.id } - ${ media.fileName }`);
      }
    } else {
      // Try again
      media.sourceAttempts++;
      console.log(`Reattempt #${ media.sourceAttempts } for source #${ media.source } in Media #${ media.id } - ${ media.fileName }`);

      media.resolveSource(media.sources[media.source]);
    }
  }

  startStream(stream: MediaSourceStream) {
    const sresolver: StreamResolver = getFacetById("streamresolver", stream.facetId);
    const task = this.getTask();
    const out = new MediaStream(this);

    if (!this.outStream) {
      this.outStream = fs.createWriteStream(task.dlDir + path.sep + this.fileName);
    }

    this.lastUpdate = Date.now();
    this.request = sresolver.resolve(stream.url, this.bytes, out, null, stream.options || {});

    sresolver.lastUse = Date.now();
  }

  getTask() {
    return crud.getTask(this.taskId);
  }
}

export
class MediaStream extends Writable {
  mediaAttempt: number;

  constructor(
    public media: Media,
  ) {
    super({});

    this.mediaAttempt = media.totalAttempts;
  }

  setSize(size: number) {
    this.media.size = size;
  }

  error(err: any) {
    this.end();
    this.media.reattemptSources();
  }

  _write(chunk: Buffer, encoding: string, callback: (err?: Error) => void) {
    this.media.buffer = Buffer.concat([this.media.buffer, chunk], chunk.length + this.media.buffer.length);
    this.media.bufferedBytes += chunk.length;

    // FIXME: Maybe some checks here, maybe not
    callback();
  }

  _final(callback: (err?: Error) => void) {
    // TODO: Wrap up things with our Media
    callback();
  }
}

const mediaSources: MediaSource[] = [];

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
  url: string;
  parent: number;
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
  }
}
