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
function deepCopy(obj, deepArray = true) {
    let copy = {};
    switch (obj.constructor) {
        case Date:
            copy = new Date(obj.getTime());
            break;
        case RegExp:
            copy = new RegExp(obj.source, obj.pattern);
            break;
    }
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            switch (type(value)) {
                case "object":
                    copy[key] = deepCopy(value, deepArray);
                    break;
                case "array":
                    if (deepArray) {
                        const backlog = [
                            [value, copy[key] = new Array(value.length), 0],
                        ];
                        let currentMeta = backlog[0];
                        let current = currentMeta[0];
                        let copyArr = currentMeta[1];
                        arrayLoop: while (true) {
                            for (let i = currentMeta[2]; i < current.length; i++) {
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
                            }
                            else {
                                break arrayLoop;
                            }
                        }
                    }
                    else {
                        copy[key] = value.slice();
                    }
                    break;
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
function bufferConcat(buffers) {
    return Buffer.concat(buffers, buffers.reduce((a, b) => a + b.length, 0));
}
exports.bufferConcat = bufferConcat;
