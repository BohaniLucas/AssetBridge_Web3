// The upstream WDK bundler launches `npx` with execFileSync. On Windows the
// executable is npx.cmd, which Node cannot spawn without a shell. Route that
// one call directly to the installed bare-pack CLI and keep all other upstream
// bundler behavior unchanged.
const childProcess = require('node:child_process');
const path = require('node:path');
const originalExecFileSync = childProcess.execFileSync;

childProcess.execFileSync = function execFileSync(command, args = [], options = {}) {
  if (command === 'npx' && args[1] === 'bare-pack') {
    const barePackCli = path.join(path.dirname(require.resolve('bare-pack')), 'bin.js');
    return originalExecFileSync(process.execPath, [barePackCli, ...args.slice(2)], options);
  }
  return originalExecFileSync(command, args, options);
};

const { generateBundle, loadConfig } = require('@tetherto/wdk-worklet-bundler');

(async () => {
  const config = await loadConfig();
  const result = await generateBundle(config, { verbose: true });
  if (!result.success) throw new Error(result.error || 'WDK bundle generation failed.');
  console.log(`WDK bundle ready: ${result.bundlePath} (${result.bundleSize} bytes)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
