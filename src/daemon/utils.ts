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

export type JSType = "string" | "number" | "boolean" | "undefined" | "null" | "array" | "object" | "function";
export function type(value: any): JSType {
  const base = typeof value;

  if (base === "object") {
    return value === null ? "null" : (Array.isArray(value) ? "array" : "object");
  } else {
    return <JSType> base;
  }
}

export function deepCopy<InType = any>(obj: InType, deepArray = true): InType {
  let copy: {
    [key: string]: any;
  } = {};

  switch (obj.constructor) {
    case Date:
      copy = <any> new Date((<any> obj).getTime());
      break;
    case RegExp:
      copy = new RegExp((<any> obj).source, (<any> obj).pattern);
      break;
  }

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value: any = obj[key];

      switch (type(value)) {
        case "object":
          copy[key] = deepCopy(value, deepArray);
          break;
        case "array":
          if (deepArray) {
            const backlog: [any[], any[], number][] = [
              [value, copy[key] = new Array(value.length), 0],
            ];
            let currentMeta = backlog[0];
            let current: any[] = currentMeta[0];
            let copyArr: any[] = currentMeta[1];

            arrayLoop:
            while (true) {
              for (let i=currentMeta[2]; i<current.length; i++) {
                const item = current[i];

                switch (type(item)) {
                  case "object":
                    copyArr[i] = deepCopy(item, deepArray);
                    break;
                  case "array":
                    currentMeta[2] = i + 1;

                    const newArr = new Array(item.length);
                    backlog.push(currentMeta = [item, newArr, 0]);
                    copyArr[i] = newArr;

                    current = item;
                    copyArr = newArr;
                    continue arrayLoop;
                  default:
                    copyArr[i] = item;
                }
              }

              backlog.pop();

              if (backlog.length) {
                currentMeta = backlog[backlog.length - 1];

                current = currentMeta[0];
                copyArr = currentMeta[1];
              } else {
                break arrayLoop;
              }
            }
          } else {
            copy[key] = value.slice();
          }
          break;
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
