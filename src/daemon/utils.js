"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jshorts_1 = require("jshorts");
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
function getPadding(num, maxN) {
    const max = maxN + "";
    const n = num + "";
    if (/^\d+(?:\.\d+)?$/.test(n)) {
        return jshorts_1.jSh.nChars("0", max.length - n.split(".")[0].length) + n;
    }
    else if (/^\d+-\d+$/.test(n)) {
        var split = n.split("-");
        return jshorts_1.jSh.nChars("0", max.length - split[0].length) + split[0]
            + "-"
            + jshorts_1.jSh.nChars("0", max.length - split[1].length) + split[1];
    }
    // Weird crap, yay. :|
    else {
        return " " + n;
    }
}
exports.getPadding = getPadding;
function getByteSuffix(bytes) {
    var kib = 1024;
    var mib = kib * 1024;
    var gib = mib * 1024;
    var str;
    if (bytes > gib) {
        str = Math.round(bytes / gib) + " GiB";
    }
    else if (bytes > mib) {
        str = Math.round(bytes / mib) + " MiB";
    }
    else if (bytes > kib) {
        str = Math.round(bytes / kib) + " KiB";
    }
    else {
        str = bytes + " B";
    }
    return str;
}
exports.getByteSuffix = getByteSuffix;
