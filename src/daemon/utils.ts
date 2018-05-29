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
