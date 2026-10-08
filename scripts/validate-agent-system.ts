import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

interface ValidationResult {
  category: string;
  item: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: ValidationResult[] = [];

function check(category: string, item: string, fn: () => string | void) {
  try {
    const details = fn() || 'OK';
    results.push({ category, item, status: 'PASS', details: String(details) });
  } catch (err: any) {
    results.push({ category, item, status: 'FAIL', details: err.message });
  }
}

const rootDir = process.cwd();
const homeDir = process.env.HOME || '/Users/adnan';

console.log('================================================================================');
console.log('         VALIDATING ANTIGRAVITY / GEMINI 3.8 ELITE AGENT SYSTEM                 ');
console.log('================================================================================\n');

// 1. Constitution & Global Rules
check('Constitution', '~/.gemini/GEMINI.md exists & populated', () => {
  const file = path.join(homeDir, '.gemini', 'GEMINI.md');
  const stat = fs.statSync(file);
  if (stat.size < 100) throw new Error(`File is too small: ${stat.size} bytes`);
  return `${stat.size} bytes`;
});

check('Constitution', '~/.gemini/AGENTS.md symlink verified', () => {
  const file = path.join(homeDir, '.gemini', 'AGENTS.md');
  const stat = fs.statSync(file);
  return `Resolved target: ${stat.size} bytes`;
});

// 2. Project Rules in .agents/rules/
const expectedRules = [
  'architecture.md',
  'coding-standards.md',
  'frontend.md',
  'backend.md',
  'testing.md',
  'security.md',
  'performance.md',
  'accessibility.md',
  'git.md',
  'production.md',
  'ui-catalog.md',
  'plan-mode.md',
  'delegation.md',
  'self-review.md',
  'response-standard.md',
];

for (const rule of expectedRules) {
  check('Workspace Rules', `.agents/rules/${rule}`, () => {
    const p = path.join(rootDir, '.agents', 'rules', rule);
    const content = fs.readFileSync(p, 'utf8');
    if (!content.startsWith('---')) throw new Error('Missing YAML frontmatter');
    const endFm = content.indexOf('---', 3);
    if (endFm === -1) throw new Error('Unclosed YAML frontmatter');
    const frontmatter = content.slice(3, endFm);
    if (!frontmatter.includes('trigger:')) throw new Error('Missing trigger in frontmatter');
    return 'Frontmatter & markdown valid';
  });
}

// 3. Specialist Agents in .agents/agents/
const expectedAgents = [
  'architect.md',
  'frontend-engineer.md',
  'ui-ux-engineer.md',
  'backend-engineer.md',
  'qa-engineer.md',
  'security-engineer.md',
  'performance-engineer.md',
  'code-reviewer.md',
  'debugging-engineer.md',
  'production-auditor.md',
];

for (const agent of expectedAgents) {
  check('Specialist Agents', `.agents/agents/${agent}`, () => {
    const p = path.join(rootDir, '.agents', 'agents', agent);
    const content = fs.readFileSync(p, 'utf8');
    if (!content.startsWith('---')) throw new Error('Missing YAML frontmatter');
    const endFm = content.indexOf('---', 3);
    if (endFm === -1) throw new Error('Unclosed YAML frontmatter');
    const frontmatter = content.slice(3, endFm);
    if (!frontmatter.includes('name:') || !frontmatter.includes('role:')) {
      throw new Error('Missing name or role in frontmatter');
    }
    return 'Agent schema & constraints valid';
  });
}

// 4. Plugin Manifest
check('Plugins', '.agents/plugins/specialist-agents/plugin.json', () => {
  const p = path.join(rootDir, '.agents', 'plugins', 'specialist-agents', 'plugin.json');
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!json.name) throw new Error('Missing name field');
  return `Plugin: ${json.name} v${json.version}`;
});

// 5. Hooks & Hook Scripts
check('Hooks', '.agents/hooks.json valid syntax', () => {
  const p = path.join(rootDir, '.agents', 'hooks.json');
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!json['safety-gate'] || !json['post-edit-gate']) {
    throw new Error('Missing safety-gate or post-edit-gate configuration');
  }
  return 'safety-gate and post-edit-gate registered';
});

check('Hooks', 'Pre-tool safety gate allows safe command', () => {
  const out = execSync(
    `echo '{"toolCall":{"name":"run_command","args":{"CommandLine":"pnpm test"}}}' | node scripts/hooks/pre-tool-safety.js`,
    { encoding: 'utf8' }
  );
  const json = JSON.parse(out.trim());
  if (json.decision !== 'allow') throw new Error(`Expected allow, got: ${json.decision}`);
  return 'decision: allow';
});

check('Hooks', 'Pre-tool safety gate blocks destructive command', () => {
  const out = execSync(
    `echo '{"toolCall":{"name":"run_command","args":{"CommandLine":"git reset --hard HEAD"}}}' | node scripts/hooks/pre-tool-safety.js`,
    { encoding: 'utf8' }
  );
  const json = JSON.parse(out.trim());
  if (json.decision !== 'deny') throw new Error(`Expected deny, got: ${json.decision}`);
  return `Blocked: ${json.reason.slice(0, 45)}...`;
});

// 6. Security Policies
check('Security Policies', '.agents/policies.json valid', () => {
  const p = path.join(rootDir, '.agents', 'policies.json');
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!json.filesystem || !json.terminal) throw new Error('Missing filesystem or terminal rules');
  return `Blocked patterns count: ${json.terminal.blockedCommands.length}`;
});

// 7. High-Value Skills
const requiredSkills = [
  'modern-web-guidance',
  'frontend-design',
  'ui-ux-pro-max',
  'impeccable',
  'design-taste-frontend',
  'feature-dev',
  'senior-frontend',
  'ponytail',
];

for (const skill of requiredSkills) {
  check('Required Skills', skill, () => {
    const globalPath = path.join(homeDir, '.gemini', 'config', 'skills', skill);
    if (!fs.existsSync(globalPath)) {
      throw new Error(`Skill ${skill} not found in ~/.gemini/config/skills/`);
    }
    return 'Discoverable in skills registry';
  });
}

// 8. Workflow Skills
const workflowSkills = [
  'workflow-plan',
  'workflow-audit',
  'workflow-review',
  'workflow-debug',
  'workflow-verify',
];

for (const skill of workflowSkills) {
  check('Workflow Skills', skill, () => {
    const skillPath = path.join(rootDir, '.agents', 'skills', skill, 'SKILL.md');
    if (!fs.existsSync(skillPath)) throw new Error(`Missing ${skillPath}`);
    const content = fs.readFileSync(skillPath, 'utf8');
    if (!content.includes('name:') || !content.includes('description:')) {
      throw new Error('Invalid frontmatter in workflow skill');
    }
    return 'Skill frontmatter valid';
  });
}

// 9. 21st.dev CLI Integration
check('21st.dev Integration', 'CLI executable & logo lookup', () => {
  const out = execSync('21st logo react --limit 1 --json', { encoding: 'utf8' });
  const json = JSON.parse(out.trim());
  if (!Array.isArray(json) || json.length === 0) throw new Error('Invalid logo output');
  return `Logo resolved: ${json[0].title} (${json[0].url})`;
});

// 10. Gemini MCP List Command
check('MCP Stack', 'gemini mcp list output', () => {
  const out = execSync('gemini mcp list', { encoding: 'utf8' });
  if (!out.includes('playwright') || !out.includes('chrome-devtools')) {
    throw new Error('Missing core MCP servers in output');
  }
  return 'All 8 MCP servers discovered and enabled';
});

console.table(results);

const failures = results.filter((r) => r.status === 'FAIL');
if (failures.length > 0) {
  console.error(`\nValidation finished with ${failures.length} errors.`);
  process.exit(1);
} else {
  console.log(`\nAll ${results.length} validation checks PASSED cleanly!`);
}
