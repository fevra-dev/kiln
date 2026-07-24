#!/usr/bin/env node
/**
 * check-trivyignore.mjs — risk-register hygiene gate (ADR-0017).
 *
 * Fails (exit 1) if any entry in .trivyignore.yaml:
 *   - lacks a non-empty `statement`,
 *   - lacks `expired_at`, or has an invalid / already-past date,
 *   - is `direct:` and expires more than 30 days out, or
 *   - is `transitive:` (default) and expires more than 90 days out.
 *
 * Dependency-free by design (ADR-0001): a minimal line parser tuned to the
 * register's regular shape, not a general YAML library.
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? '.trivyignore.yaml';
let text;
try {
  text = readFileSync(file, 'utf8');
} catch {
  console.log(`[trivyignore] ${file} absent — nothing to check`);
  process.exit(0);
}

const DAY = 86_400_000;
const today = new Date();
today.setHours(0, 0, 0, 0);

let section = null;
let cur = null;
const entries = [];
const flush = () => {
  if (cur) entries.push(cur);
  cur = null;
};

for (const raw of text.split('\n')) {
  const line = raw.replace(/\t/g, '  ');
  if (/^\s*#/.test(line) || line.trim() === '') continue;

  const sec = line.match(/^(vulnerabilities|licenses|secrets|misconfigurations):\s*$/);
  if (sec) {
    flush();
    section = sec[1];
    continue;
  }
  const idm = line.match(/^\s*-\s*id:\s*(.+?)\s*$/);
  if (idm) {
    flush();
    cur = { id: idm[1].replace(/['"]/g, ''), section, statement: '', expired: null };
    continue;
  }
  const sm = line.match(/^\s*statement:\s*(.+?)\s*$/);
  if (sm && cur) {
    cur.statement = sm[1].replace(/^['"]|['"]$/g, '').trim();
    continue;
  }
  const em = line.match(/^\s*expired_at:\s*(.+?)\s*$/);
  if (em && cur) cur.expired = em[1].replace(/['"]/g, '').trim();
}
flush();

const errors = [];
for (const e of entries) {
  const where = `${e.section ?? '?'}/${e.id}`;
  if (!e.statement) errors.push(`${where}: missing 'statement'`);
  if (!e.expired) {
    errors.push(`${where}: missing 'expired_at'`);
    continue;
  }
  const exp = new Date(`${e.expired}T00:00:00`);
  if (Number.isNaN(exp.getTime())) {
    errors.push(`${where}: invalid expired_at '${e.expired}'`);
    continue;
  }
  if (exp < today) {
    errors.push(`${where}: EXPIRED (${e.expired}) — re-triage required`);
  }
  const days = Math.round((exp - today) / DAY);
  const isDirect = /^direct\b/i.test(e.statement);
  const cap = isDirect ? 30 : 90;
  if (days > cap) {
    errors.push(
      `${where}: expired_at ${e.expired} is ${days}d out (> ${cap}d cap for ${isDirect ? 'direct' : 'transitive'})`,
    );
  }
}

if (errors.length) {
  console.error(`[trivyignore] ${errors.length} register-hygiene violation(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`[trivyignore] OK — ${entries.length} entries, all justified and within expiry caps`);
