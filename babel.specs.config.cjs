// @react-native/babel-preset 0.88 asserts Babel 7 (its flow-strip-types
// override), and this repo builds with Babel 8. The Specs suite mocks
// react-native, so it needs TypeScript and JSX, not the RN preset: reuse the
// root config that the other Jest suites already compile with.
module.exports = require("./babel.config.js");
