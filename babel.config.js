module.exports = {
  presets: [
    ['@babel/preset-env', {targets: {node: 'current'}}],
    // React Native source can use TypeScript declare fields. Babel must erase
    // those fields when preparing the package for web bundlers.
    ['@babel/preset-typescript', {allowDeclareFields: true}],
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
