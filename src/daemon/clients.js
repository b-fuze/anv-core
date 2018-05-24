"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Instruction;
(function (Instruction) {
    Instruction["Load"] = "load";
    Instruction["Select"] = "select";
    Instruction["Start"] = "start";
    Instruction["Stop"] = "stop";
    Instruction["Delete"] = "delete";
})(Instruction = exports.Instruction || (exports.Instruction = {}));
exports.instructions = {
    load(done) {
    },
    select(taskId) {
    },
    start(taskId) {
    },
    stop(taskId) {
    },
    // FIXME: mediaList type
    delete(taskId, mediaList) {
    },
};
function instruction(data, conn) {
}
exports.instruction = instruction;
