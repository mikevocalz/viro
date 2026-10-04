"use strict";
/**
 * Internal TypeScript facade for the language-neutral Viro engine contract.
 *
 * This module intentionally does not expose the native uint64 capability mask as
 * a JavaScript number. React Native/JS numbers cannot safely represent arbitrary
 * 64-bit integers, so native bridges transport the mask as two uint32 words.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIRO_ENGINE_ABI_MIN_MINOR = exports.VIRO_ENGINE_ABI_MAJOR = void 0;
exports.viroEngineDomainCode = viroEngineDomainCode;
exports.viroEnginePreferenceCode = viroEnginePreferenceCode;
exports.viroEnginePreferenceFromCode = viroEnginePreferenceFromCode;
exports.decodeViroEngineCapabilities = decodeViroEngineCapabilities;
exports.normalizeViroEngineAbiInfo = normalizeViroEngineAbiInfo;
exports.queryViroEngineContract = queryViroEngineContract;
exports.hasViroEngineCapability = hasViroEngineCapability;
exports.VIRO_ENGINE_ABI_MAJOR = 0;
exports.VIRO_ENGINE_ABI_MIN_MINOR = 1;
const DOMAIN_CODE = {
    input: 0,
    spatial: 1,
    surface: 2,
    media: 3,
    geometry: 4,
    "world-mesh": 5,
    "asset-loading": 6,
};
const PREFERENCE_CODE = {
    auto: 0,
    cpp: 1,
    eskiu: 2,
};
const CODE_PREFERENCE = {
    0: "auto",
    1: "cpp",
    2: "eskiu",
};
function viroEngineDomainCode(domain) {
    return DOMAIN_CODE[domain];
}
function viroEnginePreferenceCode(preference) {
    return PREFERENCE_CODE[preference];
}
function viroEnginePreferenceFromCode(code) {
    return CODE_PREFERENCE[code] ?? "auto";
}
const CAPABILITY_BITS = [
    ["openxr", 0],
    ["ar-tracking", 1],
    ["spatial-anchors", 2],
    ["shared-frames", 3],
    ["world-mesh", 4],
    ["controller", 5],
    ["hand-tracking", 6],
    ["gaze", 7],
    ["stylus", 8],
    ["camera-texture", 9],
    ["recording", 10],
    ["external-surface", 11],
    ["dynamic-geometry", 12],
];
function backendFromNative(kind) {
    switch (kind) {
        case 1:
            return "cpp";
        case 2:
            return "eskiu";
        case 3:
            return "wasm";
        default:
            return "unknown";
    }
}
function wordHasBit(word, bit) {
    return (((word >>> 0) >>> bit) & 1) === 1;
}
function decodeViroEngineCapabilities(low, high) {
    const result = new Set();
    for (const [name, bit] of CAPABILITY_BITS) {
        const present = bit < 32 ? wordHasBit(low, bit) : wordHasBit(high, bit - 32);
        if (present)
            result.add(name);
    }
    return result;
}
function normalizeViroEngineAbiInfo(native) {
    const backend = backendFromNative(native.backendKind);
    const capabilities = decodeViroEngineCapabilities(native.capabilitiesLow, native.capabilitiesHigh);
    if (native.abiMajor !== exports.VIRO_ENGINE_ABI_MAJOR) {
        return {
            available: true,
            compatible: false,
            abiMajor: native.abiMajor,
            abiMinor: native.abiMinor,
            backend,
            capabilities,
            reason: "abi-major-mismatch",
        };
    }
    if (native.abiMinor < exports.VIRO_ENGINE_ABI_MIN_MINOR) {
        return {
            available: true,
            compatible: false,
            abiMajor: native.abiMajor,
            abiMinor: native.abiMinor,
            backend,
            capabilities,
            reason: "abi-too-old",
        };
    }
    return {
        available: true,
        compatible: true,
        abiMajor: native.abiMajor,
        abiMinor: native.abiMinor,
        backend,
        capabilities,
        reason: "ok",
    };
}
async function queryViroEngineContract(nativeModule) {
    if (!nativeModule) {
        return {
            available: false,
            compatible: false,
            abiMajor: null,
            abiMinor: null,
            backend: "unknown",
            capabilities: new Set(),
            reason: "native-module-missing",
        };
    }
    return normalizeViroEngineAbiInfo(await nativeModule.queryAbi());
}
/**
 * Capability helper for app/runtime feature gates.
 * Only compatible contract snapshots are considered usable.
 */
function hasViroEngineCapability(info, capability) {
    return !!info?.compatible && info.capabilities.has(capability);
}
