import fs from 'fs';
import path from 'path';
import os from 'os';

export function scanLocalSkills() {
  const home = os.homedir();
  const roots = [
    path.join(home, '.gemini', 'config', 'skills'),
    path.join(home, '.gemini', 'config', 'plugins'),
    path.join(home, '.gemini', 'antigravity', 'builtin', 'skills'),
  ];

  const map = new Map();

  function parseSkillMd(content, dirName, fullPath) {
    let name = dirName.replace(/\.disabled$/, '');
    let description = '';
    let category = 'coding';
    let version = '1.0.0';
    let triggers = [];

    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch) {
      const lines = fmMatch[1].split(/\r?\n/);
      for (const l of lines) {
        const idx = l.indexOf(':');
        if (idx !== -1) {
          const key = l.substring(0, idx).trim();
          const val = l.substring(idx + 1).trim();
          if (key === 'name') name = val;
          if (key === 'description') description = val;
          if (key === 'category') category = val;
          if (key === 'version') version = val;
          if (key === 'triggers') {
            triggers = val
              .replace(/^[\[\s]+|[\]\s]+$/g, '')
              .split(',')
              .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
              .filter(Boolean);
          }
        }
      }
    }

    if (!description) {
      const lines = content.split(/\r?\n/);
      const textLine = lines.find((l) => l.trim() && !l.startsWith('#') && !l.startsWith('---'));
      description = textLine ? textLine.trim() : `Local Agent Skill for ${name}`;
    }

    if (triggers.length === 0) {
      triggers = [`/${name}`];
    }

    const title = name
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    return {
      id: name,
      name,
      title,
      description,
      category,
      author: 'Local User',
      version,
      triggers,
      tags: [category, 'Local'],
      isInstalled: true,
      isEnabled: true,
      isLocal: true,
      sourceType: 'local',
      installPath: fullPath,
      localPath: fullPath,
    };
  }

  function scan(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          const skillPath = path.join(dir, e.name, 'SKILL.md');
          if (fs.existsSync(skillPath)) {
            try {
              const content = fs.readFileSync(skillPath, 'utf8');
              const item = parseSkillMd(content, e.name, skillPath);
              if (!map.has(item.id)) {
                map.set(item.id, item);
              }
            } catch {}
          } else {
            scan(path.join(dir, e.name));
          }
        }
      }
    } catch {}
  }

  for (const r of roots) scan(r);
  return Array.from(map.values());
}

export function readLocalSkillContent(skillId) {
  const skills = scanLocalSkills();
  const matched = skills.find(s => s.id === skillId || s.name === skillId);
  if (matched && matched.installPath && fs.existsSync(matched.installPath)) {
    try {
      return fs.readFileSync(matched.installPath, 'utf8');
    } catch {}
  }
  return '';
}

export function installLocalSkill(skill) {
  const home = os.homedir();
  const cleanName = (skill.name || skill.id).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const targetDir = path.join(home, '.gemini', 'config', 'skills', cleanName);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const targetFile = path.join(targetDir, 'SKILL.md');
  const content = skill.content || `---
name: ${skill.name || cleanName}
description: ${skill.description || 'Custom Skill'}
category: ${skill.category || 'coding'}
version: ${skill.version || '1.0.0'}
triggers: [${(skill.triggers || []).join(', ')}]
---

# ${skill.title || skill.name}

${skill.description || ''}
`;
  fs.writeFileSync(targetFile, content, 'utf8');
  return targetFile;
}

export function uninstallLocalSkill(skillId) {
  const home = os.homedir();
  const cleanName = skillId.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const targetDir = path.join(home, '.gemini', 'config', 'skills', cleanName);
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
}

