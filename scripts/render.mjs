#!/usr/bin/env node
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderOverlay } from './preset.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  console.log([
    'oh-my-dsh: generate the version-aligned Standard Preset overlay',
    'Usage: node scripts/render.mjs [--source FILE] [--output FILE] [--read-limit N] [--read-max-bytes N] [--check]',
    'Defaults: --source vendor/standard.patch.yml; --output cordis.patch.yml; --read-limit 160; --read-max-bytes 32768',
    '--check compares existing output and makes no changes.'
  ].join('\n'));
}
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) { usage(); process.exit(0); }
const options = {};
let check = false;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--check') { check = true; continue; }
  if (!['--source', '--output', '--read-limit', '--read-max-bytes'].includes(arg) || i + 1 >= args.length) {
    console.error('Unknown or incomplete argument: ' + arg); usage(); process.exit(2);
  }
  if (options[arg] !== undefined) { console.error('Duplicate argument: ' + arg); process.exit(2); }
  options[arg] = args[++i];
}
const sourcePath = resolve(options['--source'] ?? resolve(root, 'vendor/standard.patch.yml'));
const outputPath = resolve(options['--output'] ?? resolve(root, 'cordis.patch.yml'));
if (sourcePath === outputPath) { console.error('Source and output must differ.'); process.exit(2); }
try {
  const source = await readFile(sourcePath, 'utf8');
  const generated = renderOverlay(source, {
    readLimit: options['--read-limit'] === undefined ? 160 : Number(options['--read-limit']),
    readMaxBytes: options['--read-max-bytes'] === undefined ? 32768 : Number(options['--read-max-bytes']),
  });
  if (check) {
    const current = await readFile(outputPath, 'utf8');
    if (current !== generated) { console.error('Overlay is stale: regenerate ' + outputPath); process.exitCode = 1; }
    else console.log('OK: overlay matches source and configured defaults.');
  } else {
    await mkdir(dirname(outputPath), { recursive: true });
    const tmp = outputPath + '.oh-my-dsh-tmp-' + process.pid;
    try {
      await writeFile(tmp, generated, { encoding: 'utf8', flag: 'wx' });
      await rename(tmp, outputPath);
    } catch (error) {
      const { unlink } = await import('node:fs/promises');
      await unlink(tmp).catch(() => {});
      throw error;
    }
    console.log('Generated ' + outputPath + ' from ' + sourcePath);
    console.log('Review the diff before installing; this overlay replaces the entire Standard preset config.');
  }
} catch (error) {
  console.error('oh-my-dsh: ' + (error?.message ?? String(error)));
  process.exitCode = 1;
}
