"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function type(value) {
    const base = typeof value;
    if (base === "object") {
        return value === null ? "null" : (Array.isArray(value) ? "array" : "object");
    }
    else {
        return base;
    }
}
exports.type = type;
function deepCopy(obj) {
    const copy = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
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
    return copy;
}
exports.deepCopy = deepCopy;
