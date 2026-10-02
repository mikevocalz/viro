# Engine contract bridge shape

The native ABI uses a `uint64_t` capability mask. JavaScript must **not** receive that mask as a single number because IEEE-754 numbers cannot represent arbitrary 64-bit integers exactly.

Native bridges therefore expose:

```ts
interface ViroEngineNativeAbiInfo {
  structSize: number;
  abiMajor: number;
  abiMinor: number;
  backendKind: number;
  capabilitiesLow: number;  // uint32 bits 0..31
  capabilitiesHigh: number; // uint32 bits 32..63
}
```

The internal TypeScript facade converts those words into named capabilities.

This keeps:
- the C ABI compact;
- JNI/ObjC++/Swift/WASM transport lossless;
- React code independent of C bit widths;
- future capability bits safe above JavaScript's integer precision limit.

The facade is dependency-injected rather than importing React Native's `NativeModules` directly. Platform bridge files will supply the native implementation in a later PR. That keeps negotiation logic testable on Node/Web and avoids pretending a bridge exists before it has been implemented.
