import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Layers,
  LoaderCircle,
  PlayCircle,
  RefreshCw,
  Repeat,
  Search,
  Sparkles,
  Timer,
} from 'lucide-react';
import type { ExamCategory, ExamLanguage, Question, TestConfig } from '../types/exam';
import {
  buildPyqTestConfig,
  DEFAULT_PYQ_FILTER,
  filterPyq,
  formatExamDate,
  levelShort,
  loadPyqIndex,
  loadPyqQuestions,
  pickPyqIds,
  PYQ_CATEGORIES,
  type PyqFilter,
  type PyqIndex,
  type PyqMeta,
  sittingVersions,
  startMinutes,
} from '../utils/pyq';
import { AskedInChips, ImageList, PassageBlock, SourceNotes } from './QuestionExtras';

interface PyqViewProps {
  seenIds: string[];
  bookmarkedIds: string[];
  language: ExamLanguage;
  prioritizeUnseen: boolean;
  onStartTest: (config: TestConfig, questions: Question[]) => void;
  onToggleBookmark: (id: string) => void;
}

type SubTab = 'mock' | 'papers' | 'browse' | 'repeated';

const SHORT_CAT: Record<string, string> = {
  'General Awareness': 'GA',
  Mathematics: 'Maths',
  'General Intelligence & Reasoning': 'Reasoning',
};

const PAGE_SIZE = 15;

// ------------------------------------------------------------------ small UI helpers
const Chip: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
      active
        ? 'bg-indigo-600 text-white shadow-xs'
        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
    }`}
  >
    {children}
  </button>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
    {children}
  </div>
);

function toggleIn<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** Load question bodies for a list of ids; loading is derived from the request key (no setState in effect body). */
function usePyqQuestions(index: PyqIndex, ids: string[]) {
  const key = useMemo(() => ids.join(','), [ids]);
  const [state, setState] = useState<{ key: string; questions: Question[]; error: string | null }>({
    key: '',
    questions: [],
    error: null,
  });
  useEffect(() => {
    if (!key) return;
    let alive = true;
    loadPyqQuestions(index, key.split(','))
      .then((questions) => {
        if (alive) setState({ key, questions, error: null });
      })
      .catch((err: unknown) => {
        if (alive) setState({ key, questions: [], error: err instanceof Error ? err.message : 'Failed to load' });
      });
    return () => {
      alive = false;
    };
  }, [index, key]);
  const ready = !key || state.key === key;
  return {
    questions: ready && key ? state.questions : [],
    loading: !ready,
    error: ready ? state.error : null,
  };
}

const Pager: React.FC<{ page: number; pages: number; onPage: (p: number) => void }> = ({
  page,
  pages,
  onPage,
}) => {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <button
        type="button"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" /> Prev
      </button>
      <span className="text-xs font-medium text-slate-600">
        Page {page + 1} of {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages - 1}
        onClick={() => onPage(page + 1)}
        className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-40"
      >
        Next <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

/** One previous-year question with its answer hidden until asked, plus where it was asked. */
const PyqQuestionCard: React.FC<{
  q: Question;
  number: number;
  bookmarked: boolean;
  onToggleBookmark: (id: string) => void;
}> = ({ q, number, bookmarked, onToggleBookmark }) => {
  const [show, setShow] = useState(false);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
            #{number}
          </span>
          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
            {q.category}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onToggleBookmark(q.id)}
          className={`inline-flex min-h-8 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-semibold ${
            bookmarked
              ? 'border-amber-300 bg-amber-50 text-amber-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? 'fill-current' : ''}`} />
          {bookmarked ? 'Saved' : 'Save'}
        </button>
      </div>

      <AskedInChips source={q.source} />

      <div className="mt-3">
        <PassageBlock passage={q.passage} images={q.passageImages} />
        <p className="text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">
          {q.question}
        </p>
        <ImageList srcs={q.images} alt="Question figure" />
      </div>

      <ol className="mt-3 space-y-2">
        {q.options.map((opt, i) => {
          const isCorrect = show && opt === q.correctAnswer;
          return (
            <li
              key={opt}
              className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-sm ${
                isCorrect
                  ? 'border-emerald-400 bg-emerald-50 font-semibold text-emerald-900'
                  : 'border-slate-200 text-slate-800'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="min-w-0 pt-0.5 leading-snug">
                {opt}
                <ImageList srcs={q.optionImages?.[i]} alt={`Option ${i + 1}`} />
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {show ? 'Hide answer' : 'Show answer'}
        </button>
      </div>
      {show && (
        <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-700">
          <strong>Answer:</strong> {q.correctAnswer}
          <br />
          <strong>Explanation:</strong> {q.explanation}
        </p>
      )}
      <SourceNotes source={q.source} hasImage={Boolean(q.images?.length)} />
    </article>
  );
};

// ------------------------------------------------------------------ main view
export const PyqView: React.FC<PyqViewProps> = (props) => {
  const [index, setIndex] = useState<PyqIndex | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadPyqIndex()
      .then((ix) => {
        if (alive) setIndex(ix);
      })
      .catch((err: unknown) => {
        if (alive) setLoadError(err instanceof Error ? err.message : 'Could not load the question bank.');
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (!index) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center">
        {loadError ? (
          <>
            <p className="text-sm font-semibold text-rose-700">{loadError}</p>
            <button
              type="button"
              onClick={() => {
                setLoadError(null);
                setAttempt((a) => a + 1);
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </>
        ) : (
          <>
            <LoaderCircle className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium text-slate-600">Loading 45,000+ previous-year questions…</p>
          </>
        )}
      </div>
    );
  }
  return <PyqLoaded {...props} index={index} />;
};

const PyqLoaded: React.FC<PyqViewProps & { index: PyqIndex }> = ({
  index,
  seenIds,
  bookmarkedIds,
  language,
  prioritizeUnseen,
  onStartTest,
  onToggleBookmark,
}) => {
  const [tab, setTab] = useState<SubTab>('mock');
  const [busy, setBusy] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const seen = new Set(seenIds);
    return {
      total: index.metas.length,
      sittings: index.sittings.length,
      rep2: index.metas.filter((m) => m.repeat >= 2).length,
      rep3: index.metas.filter((m) => m.repeat >= 3).length,
      seen: index.metas.filter((m) => seen.has(m.id)).length,
    };
  }, [index, seenIds]);

  const start = (
    title: string,
    ids: string[],
    opts: { stage: string; timed: boolean; negative: boolean; practice: boolean; paper?: boolean },
  ) => {
    if (ids.length === 0) {
      setStartError('No questions match these filters.');
      return;
    }
    setStartError(null);
    setBusy('Loading questions…');
    loadPyqQuestions(index, ids, (done, total) => setBusy(`Loading questions… ${done}/${total}`))
      .then((questions) => {
        setBusy(null);
        if (questions.length === 0) {
          setStartError('Could not load these questions.');
          return;
        }
        onStartTest(
          buildPyqTestConfig({ title, questionIds: questions.map((q) => q.id), ...opts }),
          questions,
        );
      })
      .catch((err: unknown) => {
        setBusy(null);
        setStartError(err instanceof Error ? err.message : 'Could not load questions.');
      });
  };

  const tabs: Array<{ id: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'mock', label: 'Mock Tests', icon: Timer },
    { id: 'papers', label: 'Original Papers', icon: FileText },
    { id: 'repeated', label: 'Most Repeated', icon: Repeat },
    { id: 'browse', label: 'Browse & Search', icon: Search },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-md sm:p-6">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-indigo-200 ring-1 ring-white/15">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          Real RRB NTPC questions {index.years[0]}–{index.years[index.years.length - 1]}
        </div>
        <h1 className="mt-2 text-xl font-extrabold sm:text-2xl">Previous Year Papers (PYQ)</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-300 sm:text-sm">
          Every question appears once, tagged with each exam (date &amp; shift) it was asked in.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Unique questions', value: stats.total.toLocaleString('en-IN') },
            { label: 'Exam shifts', value: String(stats.sittings) },
            { label: 'Asked 2+ times', value: stats.rep2.toLocaleString('en-IN') },
            { label: 'You have seen', value: stats.seen.toLocaleString('en-IN') },
          ].map((k) => (
            <div key={k.label} className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
              <div className="text-lg font-extrabold">{k.value}</div>
              <div className="text-[11px] text-slate-300">{k.label}</div>
            </div>
          ))}
        </div>
      </section>

      <nav className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition sm:justify-start ${
                tab === t.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </nav>

      {(busy || startError) && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
            busy ? 'bg-indigo-50 text-indigo-800' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {busy ?? startError}
        </div>
      )}

      {tab === 'mock' && (
        <MockPanel
          index={index}
          seenIds={seenIds}
          prioritizeUnseen={prioritizeUnseen}
          language={language}
          busy={Boolean(busy)}
          onStart={start}
        />
      )}
      {tab === 'papers' && <PapersPanel index={index} busy={Boolean(busy)} onStart={start} />}
      {tab === 'repeated' && (
        <RepeatedPanel
          index={index}
          bookmarkedIds={bookmarkedIds}
          busy={Boolean(busy)}
          onToggleBookmark={onToggleBookmark}
          onStart={start}
        />
      )}
      {tab === 'browse' && (
        <BrowsePanel
          index={index}
          bookmarkedIds={bookmarkedIds}
          language={language}
          busy={Boolean(busy)}
          onToggleBookmark={onToggleBookmark}
          onStart={start}
        />
      )}
    </div>
  );
};

type StartFn = (
  title: string,
  ids: string[],
  opts: { stage: string; timed: boolean; negative: boolean; practice: boolean; paper?: boolean },
) => void;

// ------------------------------------------------------------------ shared filter controls
const FilterControls: React.FC<{
  index: PyqIndex;
  filter: PyqFilter;
  onChange: (f: PyqFilter) => void;
  showStageLevel?: boolean;
}> = ({ index, filter, onChange, showStageLevel = true }) => (
  <div className="space-y-4">
    <div>
      <FieldLabel>Exam year (asked in)</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        <Chip active={filter.years.length === 0} onClick={() => onChange({ ...filter, years: [] })}>
          All years
        </Chip>
        {index.years.map((y) => (
          <Chip
            key={y}
            active={filter.years.includes(y)}
            onClick={() => onChange({ ...filter, years: toggleIn(filter.years, y) })}
          >
            {y}
          </Chip>
        ))}
      </div>
    </div>
    {showStageLevel && (
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel>Stage</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {(['any', 'CBT-1', 'CBT-2'] as const).map((s) => (
              <Chip key={s} active={filter.stage === s} onClick={() => onChange({ ...filter, stage: s })}>
                {s === 'any' ? 'Any' : s}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Level</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {(['any', 'Graduate', 'Undergraduate'] as const).map((l) => (
              <Chip key={l} active={filter.level === l} onClick={() => onChange({ ...filter, level: l })}>
                {l === 'any' ? 'Any' : l === 'Undergraduate' ? 'Under Graduate' : l}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    )}
    <div>
      <FieldLabel>Sections</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        <Chip
          active={filter.categories.length === 0}
          onClick={() => onChange({ ...filter, categories: [] })}
        >
          All sections
        </Chip>
        {PYQ_CATEGORIES.map((c) => (
          <Chip
            key={c}
            active={filter.categories.includes(c)}
            onClick={() => onChange({ ...filter, categories: toggleIn<ExamCategory>(filter.categories, c) })}
          >
            {SHORT_CAT[c]}
          </Chip>
        ))}
      </div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <FieldLabel>Question language</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['any', 'Any'],
              ['en', 'English'],
              ['hi', 'हिंदी'],
            ] as const
          ).map(([v, label]) => (
            <Chip key={v} active={filter.lang === v} onClick={() => onChange({ ...filter, lang: v })}>
              {label}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Asked in exams</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3].map((n) => (
            <Chip key={n} active={filter.minRepeat === n} onClick={() => onChange({ ...filter, minRepeat: n })}>
              {n === 1 ? 'All' : `${n}+ times`}
            </Chip>
          ))}
        </div>
      </div>
    </div>
    <label className="flex min-h-9 items-center gap-2 text-xs font-medium text-slate-700">
      <input
        type="checkbox"
        checked={filter.excludeOcr}
        onChange={(e) => onChange({ ...filter, excludeOcr: e.target.checked })}
        className="h-4 w-4 rounded border-slate-300"
      />
      Only clean text questions (skip ones read by OCR from scans)
    </label>
  </div>
);

function filterTitle(f: PyqFilter): string {
  const parts = ['PYQ'];
  if (f.years.length) parts.push(f.years.slice().sort().join(', '));
  if (f.stage !== 'any') parts.push(f.stage);
  if (f.level !== 'any') parts.push(f.level === 'Undergraduate' ? 'UG' : 'Graduate');
  if (f.categories.length) parts.push(f.categories.map((c) => SHORT_CAT[c]).join(' + '));
  if (f.minRepeat > 1) parts.push(`asked ${f.minRepeat}+ times`);
  return parts.join(' · ');
}

// ------------------------------------------------------------------ Mock tests
const MockPanel: React.FC<{
  index: PyqIndex;
  seenIds: string[];
  prioritizeUnseen: boolean;
  language: ExamLanguage;
  busy: boolean;
  onStart: StartFn;
}> = ({ index, seenIds, prioritizeUnseen, language, busy, onStart }) => {
  const [filter, setFilter] = useState<PyqFilter>({
    ...DEFAULT_PYQ_FILTER,
    lang: language === 'hi' ? 'hi' : language === 'en' ? 'en' : 'any',
  });
  const [count, setCount] = useState(100);
  const [mode, setMode] = useState<'exam' | 'practice'>('exam');
  const [negative, setNegative] = useState(true);
  const [official, setOfficial] = useState(true);
  const pool = useMemo(() => filterPyq(index, filter), [index, filter]);
  const latest = index.years[index.years.length - 1];

  const run = (f: PyqFilter, n: number, title: string, practice = mode === 'practice') => {
    const p = filterPyq(index, f);
    const pattern =
      official && f.categories.length === 0 ? (f.stage === 'CBT-2' ? 'cbt2' : 'cbt1') : 'random';
    const ids = pickPyqIds(p, n, pattern, seenIds, prioritizeUnseen);
    onStart(`${title} (${ids.length} Qs)`, ids, {
      stage: f.stage,
      timed: !practice,
      negative: !practice && negative,
      practice,
    });
  };

  const presets = [
    {
      label: 'Full CBT-1 mock',
      sub: '100 Qs · 90 min · 40:30:30',
      f: { ...filter, years: [], stage: 'CBT-1' as const, categories: [], minRepeat: 1 },
      n: 100,
      title: 'PYQ CBT-1 Full Mock',
    },
    {
      label: 'Full CBT-2 mock',
      sub: '120 Qs · 90 min · 50:35:35',
      f: { ...filter, years: [], stage: 'CBT-2' as const, categories: [], minRepeat: 1 },
      n: 120,
      title: 'PYQ CBT-2 Full Mock',
    },
    {
      label: `${latest} papers mock`,
      sub: `100 Qs from ${latest} exams`,
      f: { ...filter, years: [latest], stage: 'any' as const, categories: [], minRepeat: 1 },
      n: 100,
      title: `PYQ ${latest} Mock`,
    },
    {
      label: 'Repeated questions',
      sub: 'Asked in 2+ exams',
      f: { ...DEFAULT_PYQ_FILTER, lang: filter.lang, minRepeat: 2 },
      n: 100,
      title: 'PYQ Repeated Questions Mock',
    },
  ];

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-900">Quick start</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={busy}
              onClick={() => run(p.f, p.n, p.title, false)}
              className="flex min-h-20 flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-xs transition hover:border-indigo-300 hover:bg-indigo-50/40 disabled:opacity-50"
            >
              <PlayCircle className="h-5 w-5 text-indigo-600" />
              <span className="mt-1 text-sm font-bold text-slate-900">{p.label}</span>
              <span className="text-[11px] text-slate-500">{p.sub}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
          <Layers className="h-5 w-5 text-indigo-600" />
          Build your own mock
        </h2>
        <FilterControls index={index} filter={filter} onChange={setFilter} />

        <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Number of questions</FieldLabel>
            <div className="flex flex-wrap items-center gap-1.5">
              {[25, 50, 100, 120].map((n) => (
                <Chip key={n} active={count === n} onClick={() => setCount(n)}>
                  {n}
                </Chip>
              ))}
              <input
                type="number"
                min={1}
                max={200}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                className="h-9 w-20 rounded-lg border border-slate-300 px-2 text-sm"
                aria-label="Custom number of questions"
              />
            </div>
          </div>
          <div>
            <FieldLabel>Mode</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={mode === 'exam'} onClick={() => setMode('exam')}>
                Timed exam
              </Chip>
              <Chip active={mode === 'practice'} onClick={() => setMode('practice')}>
                Practice (see answers)
              </Chip>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 text-xs font-medium text-slate-700 sm:flex-row sm:gap-6">
          <label className="flex min-h-9 items-center gap-2">
            <input
              type="checkbox"
              checked={official}
              onChange={(e) => setOfficial(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Official section ratio (CBT-1 40:30:30 / CBT-2 50:35:35)
          </label>
          {mode === 'exam' && (
            <label className="flex min-h-9 items-center gap-2">
              <input
                type="checkbox"
                checked={negative}
                onChange={(e) => setNegative(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Negative marking (−1/3)
            </label>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-700">
            <strong className="text-slate-900">{pool.length.toLocaleString('en-IN')}</strong> questions
            match · test will have{' '}
            <strong className="text-slate-900">{Math.min(count, pool.length)}</strong>
            {mode === 'exam' && pool.length > 0 && (
              <>
                {' '}
                · {Math.round((Math.min(count, pool.length) * (filter.stage === 'CBT-2' ? 45 : 54)) / 60)} min
              </>
            )}
          </p>
          <button
            type="button"
            disabled={busy || pool.length === 0}
            onClick={() => run(filter, count, filterTitle(filter))}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
          >
            <PlayCircle className="h-5 w-5" />
            Start {mode === 'exam' ? 'mock test' : 'practice'}
          </button>
        </div>
      </section>
    </div>
  );
};

// ------------------------------------------------------------------ Original papers (exact replay)
const PapersPanel: React.FC<{ index: PyqIndex; busy: boolean; onStart: StartFn }> = ({
  index,
  busy,
  onStart,
}) => {
  const years = useMemo(
    () =>
      Array.from(new Set(index.sittings.map((s) => s.y).filter((y): y is number => Boolean(y)))).sort(
        (a, b) => b - a,
      ),
    [index],
  );
  const [year, setYear] = useState<number>(years[0]);
  const [stage, setStage] = useState<'any' | 'CBT-1' | 'CBT-2'>('any');
  const [practice, setPractice] = useState(false);

  const sittings = useMemo(
    () =>
      index.sittings
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.y === year && (stage === 'any' || s.s === stage))
        .sort((a, b) => a.s.d.localeCompare(b.s.d) || startMinutes(a.s.t) - startMinutes(b.s.t) || (a.s.sh ?? 9) - (b.s.sh ?? 9)),
    [index, year, stage],
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <p className="mb-3 text-xs leading-relaxed text-slate-600">
          Attempt an exam shift exactly as it was set — same questions, same order. Unreadable
          questions were skipped during extraction, so a paper may have slightly fewer than 100/120.
        </p>
        <FieldLabel>Year</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {years.map((y) => (
            <Chip key={y} active={year === y} onClick={() => setYear(y)}>
              {y}
            </Chip>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {(['any', 'CBT-1', 'CBT-2'] as const).map((s) => (
            <Chip key={s} active={stage === s} onClick={() => setStage(s)}>
              {s === 'any' ? 'All stages' : s}
            </Chip>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:inline-block" />
          <Chip active={!practice} onClick={() => setPractice(false)}>
            Timed exam
          </Chip>
          <Chip active={practice} onClick={() => setPractice(true)}>
            Practice
          </Chip>
        </div>
      </section>

      <p className="text-xs font-semibold text-slate-500">{sittings.length} exam shifts</p>
      <div className="grid gap-3 md:grid-cols-2">
        {sittings.map(({ s, i }) => {
          const versions = sittingVersions(index, i);
          return (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    <CalendarDays className="h-4 w-4 text-indigo-600" />
                    {formatExamDate(s.d)}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {[s.sh ? `Shift ${s.sh}` : '', s.t].filter(Boolean).join(' · ') || 'Shift n/a'}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {s.s && (
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                      {s.s}
                    </span>
                  )}
                  {s.lv && (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {levelShort(s.lv)}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {versions.map((v) => (
                  <button
                    key={v.paper}
                    type="button"
                    disabled={busy || v.count === 0}
                    onClick={() =>
                      onStart(
                        `${s.s || 'RRB NTPC'} ${formatExamDate(s.d)}${s.sh ? ` Shift ${s.sh}` : ''} (${v.lang})`,
                        index.papers[v.paper].q,
                        { stage: s.s, timed: !practice, negative: !practice, practice, paper: !practice },
                      )
                    }
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <PlayCircle className="h-4 w-4" />
                    {v.lang === 'Hindi' ? 'हिंदी' : v.lang} · {v.count} Qs
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ Most repeated
const RepeatedPanel: React.FC<{
  index: PyqIndex;
  bookmarkedIds: string[];
  busy: boolean;
  onToggleBookmark: (id: string) => void;
  onStart: StartFn;
}> = ({ index, bookmarkedIds, busy, onToggleBookmark, onStart }) => {
  const [minRepeat, setMinRepeat] = useState(2);
  const [category, setCategory] = useState<ExamCategory | 'all'>('all');
  const [page, setPage] = useState(0);
  const pool = useMemo(
    () =>
      index.metas
        .filter((m) => m.repeat >= minRepeat && (category === 'all' || m.category === category))
        .sort((a, b) => b.repeat - a.repeat || b.years[b.years.length - 1] - a.years[a.years.length - 1]),
    [index, minRepeat, category],
  );
  const pages = Math.ceil(pool.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, pages - 1));
  const pageIds = pool.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE).map((m) => m.id);
  const { questions, loading, error } = usePyqQuestions(index, pageIds);
  const bookmarks = new Set(bookmarkedIds);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <p className="mb-3 text-xs leading-relaxed text-slate-600">
          Questions RRB has set again in different exam shifts — the highest-value revision list.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[2, 3, 4].map((n) => (
            <Chip
              key={n}
              active={minRepeat === n}
              onClick={() => {
                setMinRepeat(n);
                setPage(0);
              }}
            >
              Asked {n}+ times
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip
            active={category === 'all'}
            onClick={() => {
              setCategory('all');
              setPage(0);
            }}
          >
            All sections
          </Chip>
          {PYQ_CATEGORIES.map((c) => (
            <Chip
              key={c}
              active={category === c}
              onClick={() => {
                setCategory(c);
                setPage(0);
              }}
            >
              {SHORT_CAT[c]}
            </Chip>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy || pool.length === 0}
            onClick={() =>
              onStart(`Repeated PYQs (${minRepeat}+ times) Practice`, pool.slice(0, 100).map((m) => m.id), {
                stage: 'any',
                timed: false,
                negative: false,
                practice: true,
              })
            }
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-bold text-indigo-700 disabled:opacity-50"
          >
            Practice these ({Math.min(100, pool.length)})
          </button>
          <button
            type="button"
            disabled={busy || pool.length === 0}
            onClick={() =>
              onStart(
                `Repeated PYQs (${minRepeat}+ times) Mock`,
                pickPyqIds(pool, 100, 'random', [], false),
                { stage: 'any', timed: true, negative: true, practice: false },
              )
            }
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            <Timer className="h-4 w-4" /> Timed mock ({Math.min(100, pool.length)} Qs)
          </button>
        </div>
      </section>

      <p className="text-xs font-semibold text-slate-500">
        {pool.length.toLocaleString('en-IN')} questions
      </p>
      <QuestionList
        questions={questions}
        loading={loading}
        error={error}
        offset={safePage * PAGE_SIZE}
        bookmarks={bookmarks}
        onToggleBookmark={onToggleBookmark}
      />
      <Pager page={safePage} pages={pages} onPage={setPage} />
    </div>
  );
};

const QuestionList: React.FC<{
  questions: Question[];
  loading: boolean;
  error: string | null;
  offset: number;
  bookmarks: Set<string>;
  onToggleBookmark: (id: string) => void;
}> = ({ questions, loading, error, offset, bookmarks, onToggleBookmark }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-600">
        <LoaderCircle className="h-5 w-5 animate-spin text-indigo-600" /> Loading questions…
      </div>
    );
  }
  if (error) return <p className="py-6 text-center text-sm text-rose-700">{error}</p>;
  if (questions.length === 0)
    return <p className="py-6 text-center text-sm text-slate-500">No questions found.</p>;
  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <PyqQuestionCard
          key={q.id}
          q={q}
          number={offset + i + 1}
          bookmarked={bookmarks.has(q.id)}
          onToggleBookmark={onToggleBookmark}
        />
      ))}
    </div>
  );
};

// ------------------------------------------------------------------ Browse & search
const BrowsePanel: React.FC<{
  index: PyqIndex;
  bookmarkedIds: string[];
  language: ExamLanguage;
  busy: boolean;
  onToggleBookmark: (id: string) => void;
  onStart: StartFn;
}> = ({ index, bookmarkedIds, language, busy, onToggleBookmark, onStart }) => {
  const [filter, setFilter] = useState<PyqFilter>({
    ...DEFAULT_PYQ_FILTER,
    lang: language === 'hi' ? 'hi' : language === 'en' ? 'en' : 'any',
    years: [index.years[index.years.length - 1]],
  });
  const [savedOnly, setSavedOnly] = useState(false);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const bookmarks = useMemo(() => new Set(bookmarkedIds), [bookmarkedIds]);

  const pool: PyqMeta[] = useMemo(() => {
    const base = filterPyq(index, filter).filter((m) => !savedOnly || bookmarks.has(m.id));
    return base.sort(
      (a, b) => b.years[b.years.length - 1] - a.years[a.years.length - 1] || b.repeat - a.repeat,
    );
  }, [index, filter, savedOnly, bookmarks]);

  // Search needs the question text, so it loads every question in the filtered pool on demand.
  const searchIds = useMemo(() => (query ? pool.map((m) => m.id) : []), [query, pool]);
  const searchState = usePyqQuestions(index, searchIds);
  const matches = useMemo(() => {
    if (!query) return [];
    const needle = query.toLowerCase();
    return searchState.questions.filter(
      (q) =>
        q.question.toLowerCase().includes(needle) ||
        q.options.some((o) => o.toLowerCase().includes(needle)),
    );
  }, [query, searchState.questions]);

  const total = query ? matches.length : pool.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, pages - 1));
  const pageIds = query ? [] : pool.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE).map((m) => m.id);
  const pageState = usePyqQuestions(index, pageIds);
  const shown = query ? matches.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE) : pageState.questions;

  const change = (f: PyqFilter) => {
    setFilter(f);
    setPage(0);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(draft.trim());
            setPage(0);
          }}
        >
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search words, e.g. Kavach, ratio, संविधान"
            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm focus:border-indigo-600 focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
          </button>
        </form>
        {query && (
          <p className="mb-3 text-xs text-slate-600">
            Searching for “{query}” in {pool.length.toLocaleString('en-IN')} questions ·{' '}
            <button
              type="button"
              className="font-semibold text-indigo-700"
              onClick={() => {
                setQuery('');
                setDraft('');
              }}
            >
              clear
            </button>
          </p>
        )}
        <FilterControls index={index} filter={filter} onChange={change} />
        <label className="mt-3 flex min-h-9 items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={savedOnly}
            onChange={(e) => {
              setSavedOnly(e.target.checked);
              setPage(0);
            }}
            className="h-4 w-4 rounded border-slate-300"
          />
          Only my saved (bookmarked) questions
        </label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-700">
            <strong>{total.toLocaleString('en-IN')}</strong> questions
          </p>
          <button
            type="button"
            disabled={busy || total === 0}
            onClick={() =>
              onStart(
                `${filterTitle(filter)} Practice`,
                (query ? matches.map((q) => q.id) : pool.map((m) => m.id)).slice(0, 100),
                { stage: filter.stage, timed: false, negative: false, practice: true },
              )
            }
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-bold text-indigo-700 disabled:opacity-50"
          >
            Practice these ({Math.min(100, total)})
          </button>
        </div>
      </section>

      <QuestionList
        questions={shown}
        loading={query ? searchState.loading : pageState.loading}
        error={query ? searchState.error : pageState.error}
        offset={safePage * PAGE_SIZE}
        bookmarks={bookmarks}
        onToggleBookmark={onToggleBookmark}
      />
      <Pager page={safePage} pages={pages} onPage={setPage} />
    </div>
  );
};
