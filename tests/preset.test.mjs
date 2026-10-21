import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { renderOverlay } from '../scripts/preset.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(resolve(root, 'vendor/standard.patch.yml'), 'utf8');
const expected = await readFile(resolve(root, 'cordis.patch.yml'), 'utf8');

test('generated overlay matches committed bundle and preserves untouched tool entries', () => {
  const result = renderOverlay(source);
  assert.equal(result, expected);
  assert.match(result, /^- id: preset-standard$/m);
  assert.match(result, /OH-MY-DSH SOURCE INSPECTION/);
  assert.match(result, /readLimit: 160/);
  assert.match(result, /readMaxBytes: 32768/);
  assert.match(result, /- id: tool-jobs/);
  assert.match(result, /sampleOverCapGlobResults: false/);
});

test('rendering twice is idempotent', () => {
  assert.equal(renderOverlay(renderOverlay(source)), expected);
});

test('can tune both caps independently', () => {
  const result = renderOverlay(source, { readLimit: 300, readMaxBytes: 40000 });
  assert.match(result, /readLimit: 300/);
  assert.match(result, /readMaxBytes: 40000/);
  assert.doesNotMatch(result, /readLimit: 160/);
});

test('invalid bounds fail closed', () => {
  assert.throws(() => renderOverlay(source, { readLimit: 0 }), /readLimit/);
  assert.throws(() => renderOverlay(source, { readLimit: 5000 }), /readLimit/);
  assert.throws(() => renderOverlay(source, { readMaxBytes: 100 }), /readMaxBytes/);
});

test('missing and ambiguous Standard presets fail closed', () => {
  assert.throws(() => renderOverlay(source.replace('- id: preset-standard', '- id: preset-other')), /preset-standard/);
  assert.throws(() => renderOverlay(source + source), /preset-standard/);
});

test('preserves a valid, correctly indented existing persona suffix', () => {
  const modified = source.replace(/^( *)(prefix: You are a coding agent powered by the \{\{model\}\} model\.)$/m,
    (_, indent, prefix) => indent + prefix + '\n' + indent + 'suffix: |\n' + indent + '  Existing rules must stay.');
  const output = renderOverlay(modified);
  assert.match(output, /Existing rules must stay\./);
  assert.match(output, /OH-MY-DSH SOURCE INSPECTION/);
  assert.equal(renderOverlay(output), output);
});

test('refuses scalar suffix and complete persona', () => {
  const scalar = source.replace(/^( *)(prefix: You are a coding agent powered by the \{\{model\}\} model\.)$/m,
    (_, indent, prefix) => indent + prefix + '\n' + indent + 'suffix: Previous inline rules');
  assert.throws(() => renderOverlay(scalar), /not a YAML block scalar/);
  const complete = source.replace(/^( *)(prefix: You are a coding agent powered by the \{\{model\}\} model\.)$/m,
    (_, indent, prefix) => indent + prefix + '\n' + indent + 'complete: true');
  assert.throws(() => renderOverlay(complete), /complete:true/);
});

test('updates existing tool-fs config without dropping other config keys', () => {
  const modified = source.replace("name: '@deepseek-ai/dsh-tool-fs'\n",
    "name: '@deepseek-ai/dsh-tool-fs'\n        config:\n          readImage: false\n          readLimit: 900\n");
  const output = renderOverlay(modified);
  assert.match(output, /readImage: false/);
  assert.match(output, /readLimit: 160/);
  assert.match(output, /readMaxBytes: 32768/);
});
