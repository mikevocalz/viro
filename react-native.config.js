module.exports = {
  dependencies: {
    expo: {
      platforms: { android: null, ios: null },
    },
  },
  // Tell consumers' autolinker to ignore the Android side of this
  // package — the host wires :react_viro / :viro_renderer through
  // settings.gradle includes (prebuilt-AAR pattern) and provides
  // ReactViroPackage manually in MainApplication.
  dependency: {
    platforms: {
      android: null,
    },
  },
};
