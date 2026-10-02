const NativeModules = {};

function requireNativeComponent(name) {
  function ViroSpecsNativeStub() {
    return null;
  }
  ViroSpecsNativeStub.displayName = name;
  return ViroSpecsNativeStub;
}

module.exports = {
  NativeModules,
  requireNativeComponent,
  processColor: (value) => value,
  findNodeHandle: () => null,
  Platform: {
    OS: "test",
    constants: {},
  },
  Image: {
    resolveAssetSource: (source) => source,
  },
};
