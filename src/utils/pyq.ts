import type { ExamCategory, ExamTag, Question, TestConfig } from '../types/exam';

/**
 * Previous-Year-Question (PYQ) bank.
 *
 * The bank is far too big to bundle (45k+ questions), so it is shipped as static files under
 * `public/pyq/` (built by `scripts/build_pyq.py`):
 *   index.json        exam sittings, papers (original question order) and one compact row per question
 *   c/<chunk>.json    question bodies grouped by year + section, fetched only when needed
 *   img/...           images that a question actually needs (diagrams, formulas, scans)
 *   tags.json         2026 syllabus sub-topic + time-sensitive flag per question (scripts/tag_pyq_2026.mjs)
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

/** Output of scripts/tag_pyq_2026.mjs, aligned with `questions` in index.json. */
interface PyqTagsRaw {
  version: number;
  topics: string[];
  t: number[]; // topic index per question, -1 = untagged
  ts: number[]; // row indexes of time-sensitive GA questions
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
  /** 2026 syllabus sub-topic (keyword-based, approximate); null when no keyword matched. */
  topic: string | null;
  /** GA question whose answer depends on when it was asked. */
  timeSensitive: boolean;
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
  /** 2026 sub-topics that have at least one tagged question, in syllabus order. */
  topics: string[];
}

/**
 * First exam year that follows the current (2026) CBT pattern. Papers from 2025 onwards are the
 * latest NTPC cycle; older current-affairs answers may have changed since.
 */
export const CURRENT_PATTERN_FROM = 2025;

export function recentYears(index: PyqIndex): number[] {
  return index.years.filter((y) => y >= CURRENT_PATTERN_FROM);
}

/** Time-sensitive GA question last asked before the current pattern — its answer may be outdated. */
export function isOutdated(m: PyqMeta): boolean {
  return m.timeSensitive && (m.years[m.years.length - 1] ?? 0) < CURRENT_PATTERN_FROM;
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

/** Minutes since midnight of the exam start time (for ordering shifts within a day); 9999 if unknown. */
export function startMinutes(t: string): number {
  const m = /(\d{1,2})[.:](\d{2})\s*(AM|PM)?/i.exec(t || '');
  if (!m) return 9999;
  let h = Number(m[1]) % 12;
  const ap = m[3]?.toUpperCase();
  if (ap === 'PM' || (!ap && h < 8)) h += 12;
  return h * 60 + Number(m[2]);
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

function buildIndex(raw: PyqIndexRaw, tags: PyqTagsRaw | null): PyqIndex {
  const yearSet = new Set<number>();
  const tagsOk = tags !== null && tags.t.length === raw.questions.length;
  const timeSensitive = new Set(tagsOk ? tags.ts : []);
  const metas: PyqMeta[] = raw.questions.map((row, i) => {
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
      topic: tagsOk && tags.t[i] >= 0 ? (tags.topics[tags.t[i]] ?? null) : null,
      timeSensitive: timeSensitive.has(i),
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
    topics: tagsOk ? tags.topics.filter((t) => metas.some((m) => m.topic === t)) : [],
  };
}

export function loadPyqIndex(): Promise<PyqIndex> {
  if (!indexPromise) {
    const raw = fetch(pyqUrl('index.json')).then((res) => {
      if (!res.ok) throw new Error(`Could not load the question index (HTTP ${res.status}).`);
      return res.json() as Promise<PyqIndexRaw>;
    });
    // Tags are optional: without them the bank still works, just without 2026 topics / outdated flags.
    const tags = fetch(pyqUrl('tags.json'))
      .then((res) => (res.ok ? (res.json() as Promise<PyqTagsRaw>) : null))
      .catch(() => null);
    indexPromise = Promise.all([raw, tags])
      .then(([r, t]) => buildIndex(r, t))
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
    subCategory: meta.topic ?? `Previous Year (${meta.years.join(', ') || 'n/a'})`,
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
      ...(meta.topic ? { topic2026: meta.topic } : {}),
      ...(meta.timeSensitive ? { timeSensitive: true } : {}),
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
  topic: string; // 2026 sub-topic, '' = all
  hideOutdated: boolean; // drop time-sensitive GA last asked before CURRENT_PATTERN_FROM
}

export const DEFAULT_PYQ_FILTER: PyqFilter = {
  years: [],
  stage: 'any',
  level: 'any',
  categories: [],
  lang: 'any',
  minRepeat: 1,
  excludeOcr: false,
  topic: '',
  hideOutdated: false,
};

/** Starting filter: in 2026 mode, recent papers only and outdated current affairs hidden. */
export function startFilter(index: PyqIndex, syllabus2026Mode: boolean, lang: PyqFilter['lang']): PyqFilter {
  return {
    ...DEFAULT_PYQ_FILTER,
    lang,
    years: syllabus2026Mode ? recentYears(index) : [],
    hideOutdated: syllabus2026Mode,
  };
}

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
    if (f.topic && m.topic !== f.topic) return false;
    if (f.hideOutdated && isOutdated(m)) return false;
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
  /** Fixed exam duration (overrides the per-question pace). */
  durationSeconds?: number;
}): TestConfig {
  return {
    id: `test_${Date.now()}`,
    title: opts.title,
    mode: opts.paper ? 'pyq_paper' : opts.practice ? 'practice' : 'pyq_mock',
    durationSeconds: opts.timed
      ? (opts.durationSeconds ??
        Math.max(300, opts.questionIds.length * secondsPerQuestion(opts.stage)))
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

// ------------------------------------------------------------------ Station Master CEN 08/2026
/**
 * CEN 08/2026 Station Master single-stage CBT: 100 Qs, 120 min, −1/3.
 * Each section draws from PYQ sub-topics (2026 tags) in priority order; later sources fill gaps.
 * English Reading Comprehension is part of "Logical Capability" but the PYQ bank has none.
 */
export const SM2026_DURATION_SECONDS = 120 * 60;

export const SM2026_SECTIONS: Array<{ name: string; count: number; sources: string[][] }> = [
  {
    name: 'Basic Science & Mathematics',
    count: 30,
    sources: [
      // ~12 science + ~18 arithmetic/algebra/geometry
      ['General Science (Physics, Chemistry, Biology - up to 10th CBSE)'],
      [
        'Number System', 'Simplification & BODMAS', 'Decimals & Fractions', 'LCM & HCF', 'Ratio & Proportion',
        'Mensuration (2D & 3D)', 'Time & Work', 'Time, Speed & Distance', 'Simple & Compound Interest',
        'Profit & Loss', 'Elementary Algebra', 'Geometry & Trigonometry',
      ],
    ],
  },
  {
    name: 'Data Analysis & Interpretation',
    count: 30,
    sources: [
      ['Data Interpretation'],
      ['Data Sufficiency', 'Venn Diagrams'],
      ['Elementary Statistics', 'Percentage'],
    ],
  },
  {
    name: 'Logical Capability',
    count: 20,
    sources: [
      [
        'Syllogism', 'Statement-Conclusion & Courses of Action', 'Blood Relations', 'Puzzles',
        'Decision Making', 'Analytical Reasoning',
      ],
    ],
  },
  {
    name: 'Mental Reasoning',
    count: 20,
    sources: [
      [
        'Analogies', 'Number & Alphabet Series', 'Coding-Decoding', 'Ranking', 'Similarities & Differences',
        'Mathematical Operations', 'Direction & Distance', 'Jumbling',
      ],
    ],
  },
];

/** Science share of the first section (the rest is maths). */
const SM2026_SCIENCE_COUNT = 12;

export function pickSm2026Ids(
  pool: PyqMeta[],
  seenIds: string[],
  unseenFirst: boolean,
): { ids: string[]; sections: Array<{ name: string; want: number; got: number }> } {
  const seen = new Set(seenIds);
  const used = new Set<string>();
  const ids: string[] = [];
  const sections = SM2026_SECTIONS.map((sec, si) => {
    let got = 0;
    sec.sources.forEach((topics, k) => {
      const topicSet = new Set(topics);
      // Section 1: cap science so maths keeps its share; every other source fills what is left.
      const limit = si === 0 && k === 0 ? Math.min(SM2026_SCIENCE_COUNT, sec.count) : sec.count;
      const candidates = pool.filter((x) => x.topic !== null && topicSet.has(x.topic) && !used.has(x.id));
      for (const m of ordered(candidates, seen, unseenFirst)) {
        if (got >= limit) break;
        used.add(m.id);
        ids.push(m.id);
        got += 1;
      }
    });
    return { name: sec.name, want: sec.count, got };
  });
  return { ids, sections };
}
