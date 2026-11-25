// Integrity check for the Previous-Year-Question bank in public/pyq (run: node scripts/check_pyq.mjs)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'public', 'pyq');
const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
const problems = [];
const bodies = new Map();

index.chunks.forEach((name, ci) => {
  for (const b of JSON.parse(readFileSync(join(dir, 'c', `${name}.json`), 'utf8'))) {
    bodies.set(b.id, { ...b, chunk: ci });
  }
});

let images = 0;
for (const [id, chunk, cat, , repeat, , papers] of index.questions) {
  const b = bodies.get(id);
  if (!b) { problems.push(`${id}: no body`); continue; }
  if (b.chunk !== chunk) problems.push(`${id}: in chunk ${b.chunk}, index says ${chunk}`);
  if (b.c !== cat) problems.push(`${id}: category mismatch`);
  if (!Array.isArray(b.o) || b.o.length !== 4) problems.push(`${id}: ${b.o?.length} options`);
  if (new Set(b.o).size !== b.o.length) problems.push(`${id}: duplicate option text`);
  if (!(b.a >= 0 && b.a < b.o.length)) problems.push(`${id}: answer index ${b.a} out of range`);
  if (!b.q?.trim() && !b.qi?.length) problems.push(`${id}: no question text or image`);
  if (repeat < 1 || papers.length < 1) problems.push(`${id}: no source paper`);
  for (const p of [...(b.qi ?? []), ...(b.oi ?? []).flat(), ...(b.pi ?? [])]) {
    images += 1;
    if (!existsSync(join(dir, p))) problems.push(`${id}: missing image ${p}`);
  }
}
for (const [i, p] of index.papers.entries()) {
  for (const id of p.q) if (!bodies.has(id)) problems.push(`paper ${i} (${p.f}): unknown question ${id}`);
}

console.log({
  questions: index.questions.length,
  bodies: bodies.size,
  uniqueIds: new Set(index.questions.map((q) => q[0])).size,
  papers: index.papers.length,
  sittings: index.sittings.length,
  chunks: index.chunks.length,
  imageRefs: images,
  askedTwicePlus: index.questions.filter((q) => q[4] >= 2).length,
  problems: problems.length,
});
if (problems.length) {
  console.log(problems.slice(0, 30).join('\n'));
  process.exit(1);
}
