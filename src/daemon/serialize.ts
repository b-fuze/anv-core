import {type} from "./utils";
import {
  Task,
  Media,
  MediaSource,
  MediaSourceDirect,
  MediaSourceMirror,
  MediaSourceStream,
  MediaStatus,
  MediaSourceType,
  mediaSources,
} from "./tasks";

export interface TaskSerialized {
  url: string;
  title: string;
  cover: string;
  providerId: string;
  provider: string;
  active: boolean;
  settings: Task["settings"];

  media: MediaSerialized[];
  mediaSources: MediaSourceSerialized[];
}

export interface MediaSerialized {
  title: string;
  fileName: string;

  selected: boolean;
  status: MediaStatus;
  bytes: number;
  size: number;
  totalAttempts: number;
  sources: number[];
  source: number;
  streamData: Media["streamData"];
  emptyStreamData: boolean;
}

export interface MediaSourceSerialized {
  id: number;
  type: MediaSourceType;
  facet: string;
  facetId: string;
  facetType: "provider" | "mirror" | "streamresolver";
  url: string;
  parent: number;
  parentType: MediaSourceType;
  resolved: boolean;
  options: any;
}

enum ShapeType {
  BASIC,
  ARRAY,
  SELECT,
  CUSTOM,
};

const taskShape = {
  url: "!string",
  title: "!string",
  cover: "!string",
  providerId: "!string",
  provider: "!string",
  active: "!boolean",
  settings: (settings: any) => {
    return type(settings) === "object";
  },
};

const mediaShape = {
  title: "!string",
  fileName: "!string",

  selected: "!boolean",
  status: ["IDLE", "ACTIVE", "PENDING", "PAUSED", "FINISHED"],
  bytes: "!number",
  size: "number",
  totalAttempts: "!number",
  sources: "!array:number",
  source: "!number",
  streamData: "!object",
  emptyStreamData: "!boolean",
};

const mediaSourceShape = {
  id: "!number",
  type: [null, "direct", "mirror", "stream"],
  facet: "!string",
  facetId: "!string",
  facetType: "!string",
  url: "string",
  parent: "number",
  parentType: [null, "direct", "mirror", "stream"],
  resolved: "!boolean",
  options: (options: any) => {
    return type(options) === "object";
  },
};

const taskShapeCache = buildShapeCache(taskShape);
const mediaShapeCache = buildShapeCache(mediaShape);
const mediaSourceShapeCache = buildShapeCache(mediaSourceShape);

export class validate {
  static task(task: any): TaskSerialized {
    const err: string[] = [];
    const valid = validateShapeCache(task, taskShapeCache, err) ? task : null;

    if (err.length) {
      console.log("ANV Corrupt Metadata:\n - " + err.join("\n - "));
    }

    return valid ? task : null;
  }

  static media(media: any): MediaSerialized {
    const err: string[] = [];
    const valid = validateShapeCache(media, mediaShapeCache, err) ? media : null;

    if (err.length) {
      console.log("ANV Corrupt Metadata:\n - " + err.join("\n - "));
    }

    return valid ? media : null;
  }

  static mediaSource(mediaSource: any): MediaSourceSerialized {
    const err: string[] = [];
    const valid = validateShapeCache(mediaSource, mediaSourceShapeCache, err) ? mediaSource : null;

    if (err.length) {
      console.log("ANV Corrupt Metadata:\n - " + err.join("\n - "));
    }

    return valid ? mediaSource : null;
  }
}

export function serialize(task: Task) {
  const sTask = serializeFromShapeCache(task, taskShapeCache) as TaskSerialized;
  const sMedia: MediaSerialized[] = [];
  const sMediaSources: MediaSourceSerialized[] = [];

  const mediaSources: MediaSource[] = [];
  const sourceIdMap: {
    [sourceId: string]: number;
  } = {};

  for (const media of task.list) {
    let sourceStart = mediaSources.length;
    mediaSources.push.apply(mediaSources, media.sources);

    const mediaSerialized = serializeFromShapeCache(media, mediaShapeCache) as MediaSerialized;
    mediaSerialized.sources = [];

    for (const source of media.sources) {
      const index = sourceStart++;

      sourceIdMap[source.id] = index;
      mediaSerialized.sources.push(index);
    }

    sMedia.push(mediaSerialized);
  }

  for (let i=0; i<mediaSources.length; i++) {
    const source = mediaSources[i];
    const serializedSource = serializeFromShapeCache(source, mediaSourceShapeCache) as MediaSourceSerialized;
    serializedSource.id = i;

    if (serializedSource.parent) {
      serializedSource.parent = sourceIdMap[serializedSource.parent];
    }

    sMediaSources.push(serializedSource);
  }

  sTask.media = sMedia;
  sTask.mediaSources = sMediaSources;

  return sTask;
}

export function deserialize(taskSrc: TaskSerialized, mediaList: MediaSerialized[], mediaSourcesList: MediaSourceSerialized[]): Task {
  const task = new Task(taskSrc.url, [], taskSrc.providerId, taskSrc.provider);

  // Copy props
  task.title = taskSrc.title;
  task.cover = taskSrc.cover;
  task.active = taskSrc.active;
  task.settings = taskSrc.settings;

  const mediaSourcesMap: {
    [id: string]: MediaSource;
  } = {};

  const mediaSourcesDeserialized: MediaSource[] = [];
  const mediaSourceIdBaseOffset = mediaSources.length;

  for (const sourceSrc of mediaSourcesList) {
    let box: MediaSource;

    switch (sourceSrc.type) {
      case MediaSourceType.Direct:
        box = new MediaSourceDirect(sourceSrc.url, sourceSrc.facet, sourceSrc.facetId);
        break;
      case MediaSourceType.Mirror:
        box = new MediaSourceMirror(sourceSrc.url, sourceSrc.facet, sourceSrc.facetId);
        break;
      case MediaSourceType.Stream:
        box = new MediaSourceStream(sourceSrc.url, sourceSrc.facet, sourceSrc.facetId);
        break;
    }

    // Copy props
    box.facetType = sourceSrc.facetType;
    box.parent = sourceSrc.parent === null ? null : sourceSrc.parent + mediaSourceIdBaseOffset;
    box.parentType = sourceSrc.parentType;
    box.resolved = sourceSrc.resolved;
    box.options = sourceSrc.options;

    mediaSourcesMap[sourceSrc.id] = box;
    mediaSourcesDeserialized.push(box);
  }

  for (const mediaSrc of mediaList) {
    const media = new Media(mediaSrc.title, mediaSrc.fileName, task.list, task.id);

    // Copy props
    media.selected = mediaSrc.selected;
    media.status = mediaSrc.status;
    media.bytes = mediaSrc.bytes;
    media.size = mediaSrc.size;
    media.totalAttempts = mediaSrc.totalAttempts;
    media.source = mediaSrc.source;
    media.streamData = mediaSrc.streamData;
    media.emptyStreamData = mediaSrc.emptyStreamData;

    for (const source of mediaSrc.sources) {
      media.sources.push(mediaSourcesMap[source]);
    }

    task.list.push(media);
  }

  return task;
}

type ShapeCache = [string, ShapeType, string | ((value: any) => boolean), boolean][];

function buildShapeCache(shape: any): ShapeCache {
  const cache = [];

  for (const key of Object.keys(shape)) {
    const value = shape[key];
    const cacheItem = [key, ShapeType.BASIC, null, false];

    switch (type(value)) {
      case "string":
        const types = <string[]> value.split(":");
        let required = false;

        if (types[0][0] === "!") {
          required = true;
          types[0] = types[0].substr(1);
        }

        if (types[0] === "array") {
          cacheItem[1] = ShapeType.ARRAY;
          cacheItem[2] = types[1] || null;
        } else {
          cacheItem[1] = ShapeType.BASIC;
          cacheItem[2] = types[0];
        }

        cacheItem[3] = required;
        break;

      case "array":
        cacheItem[1] = ShapeType.SELECT;
        cacheItem[2] = value;
        break;

      case "function":
        cacheItem[1] = ShapeType.CUSTOM;
        cacheItem[2] = value;
        break;
    }

    cache.push(cacheItem);
  }

  return <ShapeCache> cache;
}

function validateShapeCache(data: any, shape: ShapeCache, errors: string[]): boolean {
  for (const [key, shapeType, valueType, required] of shape) {
    const dataValue = data[key];
    const dataValueType = type(dataValue);
    const dataHasValue = key in data;

    switch (shapeType) {
      case ShapeType.BASIC:
        if (required && (dataValue === null || dataValue === undefined)
            || !required && dataValueType !== valueType && dataValue !== null) {
          errors.push(`Wrong basic data type for "${ key }", is "${ dataValueType }" should be "${ valueType }"`);
          return false;
        }
        break;

      case ShapeType.ARRAY:
        if (dataValueType !== "array"
            || valueType && !(<any[]> dataValue).every(item => type(item) === valueType)) {
          errors.push(`Wrong array items types for "${ key }", should be "${ valueType }"`);
          return false;
        }
        break;

      case ShapeType.SELECT:
        let valid = false;

        typeLoop:
        for (const value of <any[]>(<any> valueType)) {
          if (dataValue === value) {
            valid = true;
            break typeLoop;
          }
        }

        if (!valid) {
          errors.push(`Wrong select data type for "${ key }", is "${ dataValue }" should be "${ (<any> valueType).join(", ") }"`);
          return false;
        }
        break;

      case ShapeType.CUSTOM:
        if (!(<any> valueType)(dataValue)) {
          errors.push(`Wrong custom data type for "${ key }", is "${ dataValueType }"`);
          return false;
        }
        break;
    }
  }

  return true;
}

function serializeFromShapeCache(base: any, shape: ShapeCache): any {
  const out: any = {};

  for (const [key] of shape) {
    out[key] = base[key];
  }

  return out;
}
