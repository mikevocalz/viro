module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]sx?$": ["babel-jest", { configFile: "./babel.config.js" }],
  },
  moduleNameMapper: {
    "^@reactvision/viro-web-renderer$":
      "<rootDir>/node_modules/@reactvision/viro-web-renderer/dist/sceneApi.js",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!@reactvision/viro-web-renderer/)",
  ],
};
