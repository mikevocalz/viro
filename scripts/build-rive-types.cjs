#!/usr/bin/env node
// Targeted emit while this fork's optional web renderer remains a separate checkout.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'viro-rive-types-'));
try {
  const config = path.join(temp, 'tsconfig.json');
  fs.writeFileSync(config, JSON.stringify({
    extends: path.join(root, 'tsconfig.json'),
    compilerOptions: { rootDir: root, noEmit: false, incremental: false, lib: ["ES2020", "DOM"] },
    include: ['components/ViroRivePanel.tsx', 'components/CanvasPanel/useCanvasPanel.ts',
      'components/ViroController.tsx', 'components/ViroButton.tsx',
      'components/Utilities/ViroVersion.ts'].map(file => path.join(root, file)),
    exclude: [],
  }, null, 2));
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', config], { cwd: root, stdio: 'inherit' });
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
