import fs from 'fs';
import path from 'path';
import ts from 'typescript';

console.log('=== ADVERSARIAL CHALLENGER 2: MILESTONE 1 VERIFICATION ===\n');

// 1. Load canonical en.json
const enPath = path.resolve('src/locales/en.json');
if (!fs.existsSync(enPath)) {
  console.error('FATAL: src/locales/en.json not found!');
  process.exit(1);
}

const enJson = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

// Helper: resolve dot-separated key in enJson
function resolveKey(obj, keyPath) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (cur === null || typeof cur !== 'object' || !(part in cur)) {
      return { status: 'missing', value: undefined, failedAt: parts.slice(0, i + 1).join('.') };
    }
    cur = cur[part];
  }
  
  if (cur === null) {
    return { status: 'null', value: cur };
  }
  if (typeof cur === 'object') {
    return { status: 'object', value: cur }; // Broken: resolved to an intermediate node/object!
  }
  if (typeof cur === 'string') {
    if (cur.trim() === '') {
      return { status: 'empty_string', value: cur };
    }
    return { status: 'valid_string', value: cur };
  }
  return { status: 'non_string', value: cur, type: typeof cur };
}

// 2. Scan all files in src/
const allSrcFiles = [];
function walkSrc(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'locales' || entry.name === 'node_modules') continue;
      walkSrc(full);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      if (!entry.name.endsWith('.d.ts')) {
        allSrcFiles.push(full);
      }
    }
  }
}
walkSrc(path.resolve('src'));

console.log(`Discovered ${allSrcFiles.length} TypeScript source files in src/`);

const findings = {
  totalCalls: 0,
  resolvedStrings: 0,
  missingKeys: [],
  brokenObjects: [],
  emptyStrings: [],
  nonStringValues: [],
  dynamicCalls: [],
  interpolationMismatches: []
};

// Inspect AST for each file
for (const filePath of allSrcFiles) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const isTsx = filePath.endsWith('.tsx');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  // Check aliases from useTranslation()
  let tFunctionNames = new Set(['t']);
  
  function findAliases(node) {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer)) {
      const callExpr = node.initializer.expression;
      if (ts.isIdentifier(callExpr) && callExpr.text === 'useTranslation') {
        if (ts.isObjectBindingPattern(node.name)) {
          for (const element of node.name.elements) {
            if (element.propertyName && ts.isIdentifier(element.propertyName) && element.propertyName.text === 't') {
              if (ts.isIdentifier(element.name)) {
                tFunctionNames.add(element.name.text);
              }
            } else if (!element.propertyName && ts.isIdentifier(element.name)) {
              if (element.name.text === 't') {
                tFunctionNames.add('t');
              }
            }
          }
        }
      }
    }
    ts.forEachChild(node, findAliases);
  }
  findAliases(sourceFile);

  function getLine(node) {
    return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  }

  function evaluateCall(node) {
    findings.totalCalls++;
    const line = getLine(node);
    const relPath = path.relative(process.cwd(), filePath);
    const firstArg = node.arguments[0];

    // Case 1: String Literal
    if (ts.isStringLiteral(firstArg)) {
      const key = firstArg.text;
      checkResolvedKey(key, relPath, line, node);
      return;
    }

    // Case 2: No-substitution template literal `key`
    if (ts.isNoSubstitutionTemplateLiteral(firstArg)) {
      const key = firstArg.text;
      checkResolvedKey(key, relPath, line, node);
      return;
    }

    // Case 3: Conditional (ternary) expression
    if (ts.isConditionalExpression(firstArg)) {
      const handleBranch = (branch) => {
        if (ts.isStringLiteral(branch) || ts.isNoSubstitutionTemplateLiteral(branch)) {
          checkResolvedKey(branch.text, relPath, line, node);
        } else {
          findings.dynamicCalls.push({
            file: relPath,
            line,
            snippet: node.getText(sourceFile)
          });
        }
      };
      handleBranch(firstArg.whenTrue);
      handleBranch(firstArg.whenFalse);
      return;
    }

    // Case 4: Binary expression (e.g., 'prefix.' + var)
    // Case 5: Template literal with expressions `prefix.${var}`
    // Record as dynamic call
    findings.dynamicCalls.push({
      file: relPath,
      line,
      snippet: node.getText(sourceFile)
    });
  }

  function checkResolvedKey(key, relPath, line, node) {
    const res = resolveKey(enJson, key);
    if (res.status === 'valid_string') {
      findings.resolvedStrings++;
      
      // Check interpolation parameters
      checkInterpolation(key, res.value, node, relPath, line);
    } else if (res.status === 'missing') {
      findings.missingKeys.push({ file: relPath, line, key, failedAt: res.failedAt });
    } else if (res.status === 'object') {
      findings.brokenObjects.push({ file: relPath, line, key, sampleKeys: Object.keys(res.value).slice(0, 5) });
    } else if (res.status === 'empty_string') {
      findings.emptyStrings.push({ file: relPath, line, key });
    } else {
      findings.nonStringValues.push({ file: relPath, line, key, type: res.type, value: res.value });
    }
  }

  function checkInterpolation(key, strVal, node, relPath, line) {
    // Find {{var}} in strVal
    const matches = strVal.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return;
    const expectedVars = new Set(matches.map(m => m.slice(2, -2).trim()));

    // Check if options object passed in arguments[1] or arguments[2]
    let optionsNode = null;
    for (let i = 1; i < node.arguments.length; i++) {
      if (ts.isObjectLiteralExpression(node.arguments[i])) {
        optionsNode = node.arguments[i];
        break;
      }
    }

    if (!optionsNode) {
      // Missing options object entirely when string expects variables
      findings.interpolationMismatches.push({
        file: relPath,
        line,
        key,
        expectedVars: Array.from(expectedVars),
        passedVars: [],
        reason: 'Options object missing in t() call'
      });
      return;
    }

    const passedVars = new Set();
    for (const prop of optionsNode.properties) {
      if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
        if (ts.isIdentifier(prop.name)) {
          passedVars.add(prop.name.text);
        } else if (ts.isStringLiteral(prop.name)) {
          passedVars.add(prop.name.text);
        }
      }
    }

    const missingInCall = Array.from(expectedVars).filter(v => !passedVars.has(v));
    if (missingInCall.length > 0) {
      findings.interpolationMismatches.push({
        file: relPath,
        line,
        key,
        expectedVars: Array.from(expectedVars),
        passedVars: Array.from(passedVars),
        missingInCall,
        reason: `Missing variable in t() call: ${missingInCall.join(', ')}`
      });
    }
  }

  function visitor(node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      let isTCall = false;
      if (ts.isIdentifier(expr) && tFunctionNames.has(expr.text)) {
        isTCall = true;
      } else if (ts.isPropertyAccessExpression(expr) && expr.name.text === 't') {
        isTCall = true;
      }

      if (isTCall && node.arguments.length > 0) {
        evaluateCall(node);
      }
    }
    ts.forEachChild(node, visitor);
  }

  visitor(sourceFile);
}

console.log('--- INDEPENDENT AST PARSING RESULTS ---');
console.log(`Total t(...) calls analyzed: ${findings.totalCalls}`);
console.log(`Resolved valid strings: ${findings.resolvedStrings}`);
console.log(`Missing keys in en.json: ${findings.missingKeys.length}`);
console.log(`Broken objects resolved (non-leaf): ${findings.brokenObjects.length}`);
console.log(`Empty string values resolved: ${findings.emptyStrings.length}`);
console.log(`Non-string primitive values: ${findings.nonStringValues.length}`);
console.log(`Dynamic / Expression calls: ${findings.dynamicCalls.length}`);
console.log(`Interpolation variable mismatches: ${findings.interpolationMismatches.length}`);

if (findings.missingKeys.length > 0) {
  console.log('\n[CRITICAL] Missing Keys Detail:');
  console.log(JSON.stringify(findings.missingKeys, null, 2));
}

if (findings.brokenObjects.length > 0) {
  console.log('\n[CRITICAL] Broken Objects Detail:');
  console.log(JSON.stringify(findings.brokenObjects, null, 2));
}

if (findings.emptyStrings.length > 0) {
  console.log('\n[CRITICAL] Empty Strings Detail:');
  console.log(JSON.stringify(findings.emptyStrings, null, 2));
}

if (findings.dynamicCalls.length > 0) {
  console.log('\n[INFO] Dynamic / Expression Calls:');
  findings.dynamicCalls.forEach(d => {
    console.log(`  ${d.file}:${d.line} -> ${d.snippet}`);
  });
}

if (findings.interpolationMismatches.length > 0) {
  console.log('\n[CRITICAL/WARNING] Interpolation Mismatches:');
  console.log(JSON.stringify(findings.interpolationMismatches, null, 2));
}

// Write findings to a JSON file for analysis
fs.writeFileSync('scripts/adversarial_challenge_results.json', JSON.stringify(findings, null, 2));
console.log('\nDetailed results written to scripts/adversarial_challenge_results.json');
