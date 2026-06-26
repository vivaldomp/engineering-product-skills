const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const v = require('../tools/validate-plugin.js');

test('parseFrontmatter reads name and description', () => {
  const fm = v.parseFrontmatter('---\nname: egp-prd-builder\ndescription: Build a PRD\n---\nbody');
  assert.equal(fm.name, 'egp-prd-builder');
  assert.equal(fm.description, 'Build a PRD');
});

test('validateSkill flags name != dir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egp-'));
  try {
    const skill = path.join(dir, 'egp-prd-builder');
    fs.mkdirSync(skill);
    fs.writeFileSync(path.join(skill, 'SKILL.md'), '---\nname: wrong-name\ndescription: x\n---\n');
    const errs = v.validateSkill(skill);
    assert.ok(errs.some(e => /!=/.test(e)), errs.join(';'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('validateSkill passes a correct skill', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egp-'));
  try {
    const skill = path.join(dir, 'egp-adr-builder');
    fs.mkdirSync(skill);
    fs.writeFileSync(path.join(skill, 'SKILL.md'), '---\nname: egp-adr-builder\ndescription: Build an ADR\n---\n');
    assert.deepEqual(v.validateSkill(skill), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('validateJson flags missing keys', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egp-'));
  try {
    const p = path.join(dir, 'm.json');
    fs.writeFileSync(p, JSON.stringify({ name: 'x' }));
    const errs = v.validateJson(p, ['name', 'owner']);
    assert.ok(errs.some(e => /owner/.test(e)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('validatePlugin happy path returns empty array', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'egp-validate-'));
  try {
    // Create marketplace.json
    const marketplaceDir = path.join(tmp, '.claude-plugin');
    fs.mkdirSync(marketplaceDir, { recursive: true });
    fs.writeFileSync(path.join(marketplaceDir, 'marketplace.json'), JSON.stringify({ name: 'm', owner: {}, plugins: [] }));

    // Create plugin.json
    const pluginDir = path.join(tmp, 'plugins/product-design-suite/.claude-plugin');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({ name: 'product-design-suite', version: '0.1.0', description: 'd' }));

    // Create skill with valid frontmatter
    const skillDir = path.join(tmp, 'plugins/product-design-suite/skills/egp-x');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: egp-x\ndescription: ok\n---\n');

    assert.deepEqual(v.validatePlugin(tmp), []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('validatePlugin flags skill name mismatch', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'egp-validate-'));
  try {
    // Create marketplace.json
    const marketplaceDir = path.join(tmp, '.claude-plugin');
    fs.mkdirSync(marketplaceDir, { recursive: true });
    fs.writeFileSync(path.join(marketplaceDir, 'marketplace.json'), JSON.stringify({ name: 'm', owner: {}, plugins: [] }));

    // Create plugin.json
    const pluginDir = path.join(tmp, 'plugins/product-design-suite/.claude-plugin');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({ name: 'product-design-suite', version: '0.1.0', description: 'd' }));

    // Create skill with mismatched name
    const skillDir = path.join(tmp, 'plugins/product-design-suite/skills/egp-x');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: wrong-name\ndescription: ok\n---\n');

    const errs = v.validatePlugin(tmp);
    assert.ok(errs.length > 0, 'expected errors for name mismatch');
    assert.ok(errs.some(e => /!=/.test(e)), `expected name mismatch error, got: ${errs.join('; ')}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
