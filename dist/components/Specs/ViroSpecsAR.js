"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createViroSpecsARRuntime = createViroSpecsARRuntime;
/**
 * Stable public facade over the Specs WorldQuery/surface-placement backend.
 * Apps can keep AR feature code platform-neutral and provide the concrete
 * runtime from @viro-external/specs.
 */
function createViroSpecsARRuntime(runtime) {
    return runtime;
}
