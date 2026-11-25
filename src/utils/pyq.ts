import type { ExamCategory, ExamTag, Question, TestConfig } from '../types/exam';

/**
 * Previous-Year-Question (PYQ) bank.
 *
 * The bank is far too big to bundle (45k+ questions), so it is shipped as static files under
 * `public/pyq/` (built by `scripts/build_pyq.py`):
 *   index.json        exam sittings, papers (original question order) and one compact row per question
 *   c/<chunk>.json    question bodies grouped by year + section, fetched only when needed
 *   img/...           images that a question actually needs (diagrams, formulas, scans)
 */

export interface PyqSitting {
  d: string; // exam date YYYY-MM-DD
  y: number | null;
  t: string; // exam time, e.g. "9:00 AM - 10:30 AM"
  sh: number | null; // shift number
  s: string; // stage: CBT-1 / CBT-2 / ''
  lv: string; // Graduate / Undergraduate / ''
  cen: string;
  p: number[]; // paper indexes (language versions / copies of this sitting)
}

export interface PyqPaper {
  f: string; // source PDF file
  d: string;
  y: number | null;
  s: string;
  lv: string;
  sh: number | null;
  t: string;
  lg: string; // paper language (English / Hindi)
  dt: string; // document type
  cen: string;
  ry: number | null; // recruitment year
  si: number; // sitting index
  q: string[]; // question ids in original paper order
}

/** [id, chunk, category, lang(0 en / 1 hi), repeatCount, flags, paperIndexes] */
type PyqRow = [string, number, number, number, number, number, number[]];

interface PyqIndexRaw {
  version: number;
  cats: string[];
  chunks: string[];
  sittings: PyqSitting[];
  papers: PyqPaper[];
  questions: PyqRow[];
}

interface PyqBody {
  id: string;
  c: number;
  l: 'en' | 'hi';
  q: string;
  o: string[];
  a: number;
  e?: string;
  p?: string;
  qi?: string[];
  oi?: string[][];
  pi?: string[];
  f?: string[];
  n?: string;
}

export interface PyqMeta {
  id: string;
  chunk: number;
  category: ExamCategory;
  lang: 'en' | 'hi';
  repeat: number;
  hasImage: boolean;
  ocr: boolean;
  sectionInferred: boolean;
  hasExplanation: boolean;
  sittings: number[];
  years: number[];
  stages: string[];
  levels: string[];
}

export interface PyqIndex {
  sittings: PyqSitting[];
  papers: PyqPaper[];
  metas: PyqMeta[];
  byId: Map<string, PyqMeta>;
  years: number[];
  chunks: string[];
}

export const PYQ_CATEGORIES: ExamCategory[] = [
  'General Awareness',
  'Mathematics',
  'General Intelligence & Reasoning',
];

export function pyqUrl(path: string): string {
  return `${import.meta.env.BASE_URL}pyq/${path}`;
}

// ------------------------------------------------------------------ labels
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatExamDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || 'Date n/a';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export function startTime(t: string): string {
  const m = /(\d{1,2})[.:](\d{2})\s*(AM|PM)?/i.exec(t || '');
  if (!m) return '';
  return `${Number(m[1])}:${m[2]}${m[3] ? ` ${m[3].toUpperCase()}` : ''}`;
}

export function levelShort(lv: string): string {
  if (lv === 'Undergraduate') return 'UG';
  if (lv === 'Graduate') return 'Graduate';
  return '';
}

/** e.g. "CBT-1 · 11 Jan 2021 · Shift 2 · 3:00 PM · Graduate" */
export function sittingLabel(s: PyqSitting): string {
  return [
    s.s || 'RRB NTPC',
    formatExamDate(s.d),
    s.sh ? `Shift ${s.sh}` : '',
    startTime(s.t),
    levelShort(s.lv),
  ]
    .filter(Boolean)
    .join(' · ');
}

// ------------------------------------------------------------------ loading
let indexPromise: Promise<PyqIndex> | null = null;
const chunkCache = new Map<number, Promise<Map<string, PyqBody>>>();

function buildIndex(raw: PyqIndexRaw): PyqIndex {
  const yearSet = new Set<number>();
  const metas: PyqMeta[] = raw.questions.map((row) => {
    const [id, chunk, cat, lang, repeat, flags, paperIdx] = row;
    const sittings = Array.from(new Set(paperIdx.map((p) => raw.papers[p].si)));
    const years = Array.from(
      new Set(sittings.map((s) => raw.sittings[s].y).filter((y): y is number => Boolean(y))),
    ).sort();
    years.forEach((y) => yearSet.add(y));
    return {
      id,
      chunk,
      category: (raw.cats[cat] as ExamCategory) ?? 'General Awareness',
      lang: lang === 1 ? 'hi' : 'en',
      repeat,
      hasImage: Boolean(flags & 1),
      ocr: Boolean(flags & 2),
      sectionInferred: Boolean(flags & 4),
      hasExplanation: Boolean(flags & 8),
      sittings,
      years,
      stages: Array.from(new Set(sittings.map((s) => raw.sittings[s].s).filter(Boolean))),
      levels: Array.from(new Set(sittings.map((s) => raw.sittings[s].lv).filter(Boolean))),
    };
  });
  return {
    sittings: raw.sittings,
    papers: raw.papers,
    metas,
    byId: new Map(metas.map((m) => [m.id, m])),
    years: Array.from(yearSet).sort(),
    chunks: raw.chunks,
  };
}

export function loadPyqIndex(): Promise<PyqIndex> {
  if (!indexPromise) {
    indexPromise = fetch(pyqUrl('index.json'))
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load the question index (HTTP ${res.status}).`);
        return res.json() as Promise<PyqIndexRaw>;
      })
      .then(buildIndex)
      .catch((err: unknown) => {
        indexPromise = null; // allow retry
        throw err;
      });
  }
  return indexPromise;
}

function loadChunk(index: PyqIndex, chunk: number): Promise<Map<string, PyqBody>> {
  let p = chunkCache.get(chunk);
  if (!p) {
    p = fetch(pyqUrl(`c/${index.chunks[chunk]}.json`))
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load question data (HTTP ${res.status}).`);
        return res.json() as Promise<PyqBody[]>;
      })
      .then((bodies) => new Map(bodies.map((b) => [b.id, b])))
      .catch((err: unknown) => {
        chunkCache.delete(chunk);
        throw err;
      });
    chunkCache.set(chunk, p);
  }
  return p;
}

const DEFAULT_EXPLANATION =
  'Answer as per the official RRB answer key (the option marked correct in the source paper).';
const DEFAULT_EXPLANATION_HI =
  'उत्तर RRB की आधिकारिक उत्तर कुंजी के अनुसार (मूल प्रश्नपत्र में सही चिह्नित विकल्प)।';

function toQuestion(body: PyqBody, meta: PyqMeta, index: PyqIndex): Question {
  const askedIn = meta.sittings
    .slice()
    .sort((a, b) => index.sittings[a].d.localeCompare(index.sittings[b].d))
    .map((s) => sittingLabel(index.sittings[s]));
  const stages = meta.stages.filter((s): s is ExamTag => s === 'CBT-1' || s === 'CBT-2');
  const isHi = body.l === 'hi';
  const text = body.q.trim() || (isHi ? 'नीचे दिए गए चित्र को देखें।' : 'Refer to the image below.');
  return {
    id: body.id,
    type: 'mcq',
    category: meta.category,
    subCategory: `Previous Year (${meta.years.join(', ') || 'n/a'})`,
    examTag: stages,
    question: text,
    options: body.o,
    correctAnswer: body.o[body.a],
    explanation: body.e?.trim() || (isHi ? DEFAULT_EXPLANATION_HI : DEFAULT_EXPLANATION),
    ...(body.qi ? { images: body.qi.map(pyqUrl) } : {}),
    ...(body.oi ? { optionImages: body.oi.map((list) => list.map(pyqUrl)) } : {}),
    ...(body.p ? { passage: body.p } : {}),
    ...(body.pi ? { passageImages: body.pi.map(pyqUrl) } : {}),
    source: {
      repeatCount: meta.repeat,
      askedIn,
      years: meta.years,
      ...(meta.ocr ? { ocr: true } : {}),
      ...(meta.sectionInferred ? { sectionInferred: true } : {}),
      ...(body.n ? { note: body.n } : {}),
    },
  };
}

/** Load full question bodies for the given ids (fetching only the chunks needed), in the given order. */
export async function loadPyqQuestions(
  index: PyqIndex,
  ids: string[],
  onProgress?: (loaded: number, total: number) => void,
): Promise<Question[]> {
  const chunks = Array.from(
    new Set(ids.map((id) => index.byId.get(id)?.chunk).filter((c): c is number => c !== undefined)),
  );
  let done = 0;
  const maps = await Promise.all(
    chunks.map((c) =>
      loadChunk(index, c).then((m) => {
        done += 1;
        onProgress?.(done, chunks.length);
        return [c, m] as const;
      }),
    ),
  );
  const byChunk = new Map(maps);
  const out: Question[] = [];
  for (const id of ids) {
    const meta = index.byId.get(id);
    const body = meta ? byChunk.get(meta.chunk)?.get(id) : undefined;
    if (meta && body) out.push(toQuestion(body, meta, index));
  }
  return out;
}

// ------------------------------------------------------------------ filtering & mock building
export interface PyqFilter {
  years: number[]; // empty = all
  stage: 'any' | 'CBT-1' | 'CBT-2';
  level: 'any' | 'Graduate' | 'Undergraduate';
  categories: ExamCategory[]; // empty = all
  lang: 'any' | 'en' | 'hi';
  minRepeat: number; // 1 = all
  excludeOcr: boolean;
}

export const DEFAULT_PYQ_FILTER: PyqFilter = {
  years: [],
  stage: 'any',
  level: 'any',
  categories: [],
  lang: 'any',
  minRepeat: 1,
  excludeOcr: false,
};

export function filterPyq(index: PyqIndex, f: PyqFilter): PyqMeta[] {
  const years = new Set(f.years);
  const cats = new Set(f.categories);
  return index.metas.filter((m) => {
    if (years.size > 0 && !m.years.some((y) => years.has(y))) return false;
    if (f.stage !== 'any' && !m.stages.includes(f.stage)) return false;
    if (f.level !== 'any' && !m.levels.includes(f.level)) return false;
    if (cats.size > 0 && !cats.has(m.category)) return false;
    if (f.lang !== 'any' && m.lang !== f.lang) return false;
    if (m.repeat < f.minRepeat) return false;
    if (f.excludeOcr && m.ocr) return false;
    return true;
  });
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function ordered(pool: PyqMeta[], seen: Set<string>, unseenFirst: boolean): PyqMeta[] {
  if (!unseenFirst) return shuffle(pool);
  return [...shuffle(pool.filter((m) => !seen.has(m.id))), ...shuffle(pool.filter((m) => seen.has(m.id)))];
}

export type PyqPattern = 'cbt1' | 'cbt2' | 'random';

/** Official RRB section ratios: CBT-1 40:30:30, CBT-2 50:35:35. */
export function pickPyqIds(
  pool: PyqMeta[],
  count: number,
  pattern: PyqPattern,
  seenIds: string[],
  unseenFirst: boolean,
): string[] {
  const seen = new Set(seenIds);
  const target = Math.min(count, pool.length);
  if (pattern === 'random') {
    return ordered(pool, seen, unseenFirst)
      .slice(0, target)
      .map((m) => m.id);
  }
  const ratios =
    pattern === 'cbt1' ? [0.4, 0.3, 0.3] : [50 / 120, 35 / 120, 35 / 120];
  const picked: PyqMeta[] = [];
  const used = new Set<string>();
  PYQ_CATEGORIES.forEach((cat, i) => {
    const want = Math.round(target * ratios[i]);
    for (const m of ordered(pool.filter((x) => x.category === cat), seen, unseenFirst).slice(0, want)) {
      picked.push(m);
      used.add(m.id);
    }
  });
  if (picked.length < target) {
    for (const m of ordered(pool.filter((x) => !used.has(x.id)), seen, unseenFirst)) {
      if (picked.length >= target) break;
      picked.push(m);
    }
  }
  // exam order: section by section, like the real paper
  return picked
    .slice(0, target)
    .sort((a, b) => PYQ_CATEGORIES.indexOf(a.category) - PYQ_CATEGORIES.indexOf(b.category))
    .map((m) => m.id);
}

/** Official pace: CBT-1 90 min / 100 Qs (54 s per Q); CBT-2 90 min / 120 Qs (45 s per Q). */
export function secondsPerQuestion(stage: string): number {
  return stage === 'CBT-2' ? 45 : 54;
}

export function buildPyqTestConfig(opts: {
  title: string;
  questionIds: string[];
  stage: string;
  timed: boolean;
  negative: boolean;
  practice: boolean;
  paper?: boolean;
}): TestConfig {
  return {
    id: `test_${Date.now()}`,
    title: opts.title,
    mode: opts.paper ? 'pyq_paper' : opts.practice ? 'practice' : 'pyq_mock',
    durationSeconds: opts.timed
      ? Math.max(300, opts.questionIds.length * secondsPerQuestion(opts.stage))
      : 0,
    negativeMarking: opts.negative ? 1 / 3 : 0,
    marksPerQuestion: 1,
    instantFeedback: opts.practice,
    questionIds: opts.questionIds,
  };
}

/** Language versions available for an exam sitting (best paper per language). */
export function sittingVersions(
  index: PyqIndex,
  sittingIdx: number,
): Array<{ paper: number; lang: string; count: number }> {
  const best = new Map<string, { paper: number; lang: string; count: number }>();
  for (const p of index.sittings[sittingIdx].p) {
    const paper = index.papers[p];
    const lang = paper.lg || 'English';
    const cur = best.get(lang);
    if (!cur || paper.q.length > cur.count) best.set(lang, { paper: p, lang, count: paper.q.length });
  }
  return Array.from(best.values()).sort((a, b) => a.lang.localeCompare(b.lang));
}
