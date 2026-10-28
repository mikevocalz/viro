module.exports = {
  testEnvironment: "node",
  globals: { __DEV__: false },
  transform: {
    "^.+\\.[jt]sx?$": [
      "babel-jest",
      { configFile: "./babel.specs.config.cjs" },
    ],
  },
  moduleNameMapper: {
    "^react-native$": "<rootDir>/scripts/jest-specs-react-native.cjs",
    "^@reactvision/viro-web-renderer$":
      "<rootDir>/node_modules/@reactvision/viro-web-renderer/dist/sceneApi.js",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!((jest-)?react-native|@react-native|@reactvision/viro-web-renderer|@babel/parser)/)",
  ],
};
