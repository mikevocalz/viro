const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

test('visionOS setup preserves a wrapped Metro resolver and resolves hoisted pods; rerunning is stable', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'viro-visionos-'));
  try {
    fs.mkdirSync(path.join(root, 'visionos/Test'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({dependencies:{'@reactvision/react-native-visionos':'0.86.4','@callstack/out-of-tree-platforms':'0.77.0','@react-native-community/cli':'20.1.0'}}));
    fs.writeFileSync(path.join(root, 'metro.config.js'), 'const config = { resolver: {assetExts: [], resolveRequest: prior} };\nmodule.exports = wrap(config);\n');
    fs.writeFileSync(path.join(root, 'visionos/Podfile'), "platform :visionos, '26.0'\ntarget 'Test' do\n  config = use_native_modules!\n  config[:reactNativePath] = '../node_modules/@reactvision/react-native-visionos'\n  post_install do |installer|\n  end\nend\n");
    fs.writeFileSync(path.join(root, 'visionos/Test/App.swift'), 'import SwiftUI\nstruct TestApp: App {\n  var body: some Scene {\n    RCTMainWindow(moduleName: "Test")\n  }\n}\n');
    fs.writeFileSync(path.join(root, 'visionos/Test/Info.plist'), '<plist><dict><key>UIApplicationSupportsMultipleScenes</key><false/></dict></plist>');
    const pending = [];
    const pluginPath = path.resolve(__dirname, '../dist/plugins/withViroVisionOS.js');
    const pluginExports = {};
    const stub = {
      withDangerousMod: (c, [, fn]) => { pending.push(fn); return c; },
      withPlugins: (c, plugins) => plugins.reduce((out,p) => p(out), c),
      WarningAggregator: { addWarningIOS() {} },
    };
    vm.runInNewContext(fs.readFileSync(pluginPath,'utf8'), {exports:pluginExports, __dirname:path.dirname(pluginPath), console:{log(){}}, require: name => name === '@expo/config-plugins' ? stub : require(name)});
    const run = async () => {
      pending.length = 0;
      pluginExports.default({name:'Test'}, {applyCompatibilityPatches:false});
      for (const fn of pending) await fn({name:'Test',modRequest:{projectRoot:root}});
    };
    await run();
    const paths = ['metro.config.js','visionos/Podfile','visionos/Test/App.swift','visionos/Test/Info.plist'];
    const before = paths.map(p => fs.readFileSync(path.join(root,p),'utf8'));
    await run();
    assert.deepEqual(paths.map(p => fs.readFileSync(path.join(root,p),'utf8')),before);
    assert.match(before[1], /require.resolve\("@reactvision\/react-viro\/package.json/);
    assert.match(before[1], /config\[:reactNativePath\] = File.dirname/);
    assert.match(before[2], /ViroImmersiveSpaceView/);
    assert.match(before[3], /NSAccessoryTrackingUsageDescription/);
    const calls=[];
    const sandbox={module:{exports:{}},prior:(_c,n,p)=>{calls.push([n,p]);return n},wrap:c=>c};
    vm.runInNewContext(before[0],sandbox);
    sandbox.module.exports.resolver.resolveRequest({},'react-native/View','visionos');
    sandbox.module.exports.resolver.resolveRequest({},'react-native','android');
    assert.deepEqual(calls,[['@reactvision/react-native-visionos/View','visionos'],['react-native','android']]);
    assert.equal(fs.existsSync(path.join(root,'patches')), false);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
