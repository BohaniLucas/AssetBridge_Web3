// The upstream WDK bundler launches `npx` with execFileSync. On Windows the
// executable is npx.cmd, which Node cannot spawn without a shell. Route that
// one call directly to the installed bare-pack CLI and keep all other upstream
// bundler behavior unchanged.
const childProcess = require('node:child_process');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
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

function androidUsesBarePosixUnsupported(bundlePath) {
  const source = fs.readFileSync(bundlePath, 'utf8').trim();
  const assignmentPrefix = 'module.exports = ';
  if (!source.startsWith(assignmentPrefix)) return false;

  let packed;
  try {
    packed = JSON.parse(source.slice(assignmentPrefix.length).replace(/;$/, ''));
  } catch {
    return false;
  }

  const [headerLengthText, headerJson] = packed.split(/\r?\n/, 3);
  const headerLength = Number(headerLengthText);
  if (!Number.isSafeInteger(headerLength) || headerLength <= 0 || !headerJson) return false;
  if (Math.abs(Buffer.byteLength(headerJson, 'utf8') - headerLength) > 2) return false;

  let header;
  try {
    header = JSON.parse(headerJson);
  } catch {
    return false;
  }

  return (
    header.resolutions?.['/node_modules/bare-process/index.js']?.['bare-posix']?.android ===
    '/node_modules/bare-posix/unsupported.js'
  );
}

(async () => {
  const config = await loadConfig();
  const result = await generateBundle(config, { verbose: true });
  if (!result.success) {
    // bare-posix intentionally has no Android native prebuild. The generated
    // Android worklet resolves bare-process -> bare-posix to unsupported.js,
    // so the unused binding is not required in the APK. Accept only this exact
    // linker gap after checking the actual generated bundle resolution map.
    const errorLines = (result.error || '').split(/\r?\n/);
    const missingAddonLines = errorLines.slice(1).map((line) => line.trim()).filter(Boolean);
    const onlyExpectedAndroidGap =
      errorLines[0]?.startsWith('Native addon linking failed: bare-link produced no artefact') &&
      missingAddonLines.length === 1 &&
      missingAddonLines[0] ===
        '- android: bare-posix@1.0.1 (no prebuilds for hosts android-arm64, android-arm, android-ia32, android-x64)';
    const hasAndroidTargets = config.options?.targets?.some((target) => target.startsWith('android-'));
    if (!onlyExpectedAndroidGap || !hasAndroidTargets || !androidUsesBarePosixUnsupported(config.resolvedOutput.bundle)) {
      throw new Error(result.error || 'WDK bundle generation failed.');
    }
    console.warn('Accepted bare-posix Android linker gap: generated worklet resolves it to the unsupported.js shim.');
  }
  console.log(`WDK bundle ready: ${result.bundlePath} (${result.bundleSize} bytes)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
