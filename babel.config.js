module.exports = {
  presets: [
    ['@babel/preset-env', {targets: {node: 'current'}}],
    // Babel 8 always accepts `declare` fields (ViroCamera's `declare context`) and
    // erases them, as tsc does; the old allowDeclareFields option is gone.
    // Babel 8 defaults onlyRemoveTypeImports to true, which keeps imports that
    // are used only as types. tsc drops them, and the suites mock react-native
    // and other modules on the assumption that the type-only ones never load.
    ['@babel/preset-typescript', {onlyRemoveTypeImports: false}],
  ],
  overrides: [
    {
      // Only the JSX transform, and only for the files that contain JSX. The
      // node factory is a .tsx, and testing what it emits means compiling it;
      // preset-typescript parses JSX but leaves it for someone else to turn
      // into createElement calls.
      test: /\.[jt]sx$/,
      plugins: ['@babel/plugin-transform-react-jsx'],
    },
  ],
};
