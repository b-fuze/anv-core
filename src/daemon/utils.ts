import {jSh} from "jshorts";

// Bad place to put this, but will have to do for now FIXME
export interface FacetTiers {
  mirror: {
    [facetId: string]: string[];
  }

  provider: {
    [facetId: string]: string[];
  }
}

type JSType = "string" | "number" | "boolean" | "undefined" | "null" | "array" | "object" | "function";
export function type(value: any): JSType {
  const base = typeof value;

  if (base === "object") {
    return value === null ? "null" : (Array.isArray(value) ? "array" : "object");
  } else {
    return <JSType> base;
  }
}

export function deepCopy<InType = any>(obj: InType): InType {
  const copy: {
    [key: string]: any;
  } = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value: any = obj[key];

      switch (type(value)) {
        case "object":
          copy[key] = deepCopy(value);
          break;
        case "array":
          copy[key] = value.slice();
        default:
          copy[key] = value;
      }
    }
  }

  return <InType> copy;
}

export function getPadding(num: string | number, maxN: number) {
  const max = maxN + "";
  const n = num + "";

  if (/^\d+(?:\.\d+)?$/.test(n)) {
    return jSh.nChars("0", max.length - n.split(".")[0].length) + n;
  } else if (/^\d+-\d+$/.test(n)) {
    var split = n.split("-");

    return jSh.nChars("0", max.length - split[0].length) + split[0]
         + "-"
         + jSh.nChars("0", max.length - split[1].length) + split[1];
  }
  // Weird crap, yay. :|
  else {
    return " " + n;
  }
}

export function getByteSuffix(bytes: number): string {
  var kib = 1024;
  var mib = kib * 1024;
  var gib = mib * 1024;
  var str;

  if (bytes > gib) {
    str = Math.round(bytes / gib) + " GiB";
  } else if (bytes > mib) {
    str = Math.round(bytes / mib) + " MiB";
  } else if (bytes > kib) {
    str = Math.round(bytes / kib) + " KiB";
  } else {
    str = bytes + " B";
  }

  return str;
}

export function bufferConcat(buffers: Buffer[]) {
  return Buffer.concat(buffers, buffers.reduce((a, b) => a + b.length, 0));
}
