import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const SRC_DIR = 'src';

const EXCLUDE_ATTRS = new Set([
  'className', 'class', 'id', 'style', 'key', 'name', 'type', 'href', 'src',
  'width', 'height', 'd', 'viewBox', 'fill', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin',
  'target', 'rel', 'autoComplete', 'method', 'role', 'tabIndex', 'size', 'color',
  'dir', 'lang', 'as', 'to', 'from', 'pattern', 'accept', 'autoFocus', 'disabled', 'readOnly', 'required',
  'strokeDasharray', 'strokeDashoffset', 'transform', 'align', 'valign', 'cols', 'rows', 'step', 'min', 'max'
]);

const attrFindings = [];

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const rel = full.replace(/\\/g, '/');
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (file === '__tests__' || file === 'locales' || file === 'node_modules') continue;
      walk(full);
    } else if (file.endsWith('.tsx')) {
      checkAttributes(rel, full);
    }
  }
}

function checkAttributes(relPath, fullPath) {
  const content = fs.readFileSync(fullPath, 'utf-8');
  const sf = ts.createSourceFile(fullPath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  function getLine(pos) {
    return sf.getLineAndCharacterOfPosition(pos).line + 1;
  }

  function visitor(node) {
    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.text;
      if (!EXCLUDE_ATTRS.has(attrName) && !attrName.startsWith('data-') && !attrName.startsWith('aria-') && attrName !== 'aria-label') {
        if (node.initializer) {
          if (ts.isStringLiteral(node.initializer)) {
            const val = node.initializer.text.trim();
            if (val.length > 1 && /[a-zA-Z\u0600-\u06FF]{2,}/.test(val)) {
              attrFindings.push({
                file: relPath,
                line: getLine(node.initializer.getStart(sf)),
                attr: attrName,
                val
              });
            }
          }
        }
      }
    }
    ts.forEachChild(node, visitor);
  }
  visitor(sf);
}

walk(SRC_DIR);

console.log(`=== CUSTOM ATTRIBUTE FINDINGS ===`);
console.log(`Total findings: ${attrFindings.length}`);
for (const f of attrFindings) {
  console.log(`[${f.file}:${f.line}] ${f.attr}="${f.val.slice(0, 60)}"`);
}
