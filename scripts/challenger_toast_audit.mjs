import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const SRC_DIR = 'src';

const toastIssues = [];

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const rel = full.replace(/\\/g, '/');
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (file === '__tests__' || file === 'locales' || file === 'node_modules') continue;
      walk(full);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      if (file.endsWith('.d.ts')) continue;
      if (rel === 'src/config/skillsCatalog.ts') continue;
      checkToasts(rel, full);
    }
  }
}

function checkToasts(relPath, fullPath) {
  const content = fs.readFileSync(fullPath, 'utf-8');
  const sf = ts.createSourceFile(fullPath, content, ts.ScriptTarget.Latest, true, relPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  function getLine(pos) {
    return sf.getLineAndCharacterOfPosition(pos).line + 1;
  }

  function visitor(node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      const callText = expr.getText(sf);
      if (callText.startsWith('toast.') || callText === 'toast' || callText.startsWith('notification.') || callText === 'alert') {
        const firstArg = node.arguments[0];
        if (firstArg) {
          if (ts.isStringLiteral(firstArg)) {
            toastIssues.push({
              file: relPath,
              line: getLine(firstArg.getStart(sf)),
              call: callText,
              type: 'string_literal',
              text: firstArg.text
            });
          } else if (ts.isTemplateExpression(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
            toastIssues.push({
              file: relPath,
              line: getLine(firstArg.getStart(sf)),
              call: callText,
              type: 'template_literal',
              text: firstArg.getText(sf)
            });
          } else if (ts.isCallExpression(firstArg)) {
            // Check if it's t(...) or something else
            const innerCall = firstArg.expression.getText(sf);
            if (innerCall !== 't' && innerCall !== 'i18n.t') {
              toastIssues.push({
                file: relPath,
                line: getLine(firstArg.getStart(sf)),
                call: callText,
                type: 'non_t_call',
                text: firstArg.getText(sf)
              });
            }
          }
        }
        // Check options object (second arg)
        const secondArg = node.arguments[1];
        if (secondArg && ts.isObjectLiteralExpression(secondArg)) {
          for (const prop of secondArg.properties) {
            if (ts.isPropertyAssignment(prop)) {
              const name = prop.name.getText(sf);
              if (name === 'description' || name === 'title') {
                if (ts.isStringLiteral(prop.initializer)) {
                  toastIssues.push({
                    file: relPath,
                    line: getLine(prop.initializer.getStart(sf)),
                    call: `${callText} (opt.${name})`,
                    type: 'string_literal',
                    text: prop.initializer.text
                  });
                } else if (ts.isTemplateExpression(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
                  toastIssues.push({
                    file: relPath,
                    line: getLine(prop.initializer.getStart(sf)),
                    call: `${callText} (opt.${name})`,
                    type: 'template_literal',
                    text: prop.initializer.getText(sf)
                  });
                }
              }
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

console.log(`=== TOAST AUDIT RESULTS ===`);
console.log(`Total toast issues: ${toastIssues.length}`);
for (const issue of toastIssues) {
  console.log(`[${issue.file}:${issue.line}] ${issue.call} -> ${issue.text}`);
}
