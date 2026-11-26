import React from 'react';
import {
  ArrowRight,
  Award,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  FileText,
  Flame,
  Play,
  Target,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { EXAM_PATTERNS, SYLLABUS } from '../data/syllabus';
import type { ExamCategory, ExamTag, Question, TestAttempt, UserSettings } from '../types/exam';
import type { ActiveTab } from './Navbar';

interface DashboardViewProps {
  questions: Question[];
  seenIds: string[];
  bookmarkedIds: string[];
  testHistory: TestAttempt[];
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  onStartPreset: (preset: 'cbt1' | 'cbt2' | 'cbat') => void;
  onPracticeCategory: (category: ExamCategory) => void;
  onNavigate: (tab: ActiveTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  questions,
  seenIds,
  bookmarkedIds,
  testHistory,
  settings,
  onUpdateSettings,
  onStartPreset,
  onPracticeCategory,
  onNavigate,
}) => {
  const seenSet = new Set(seenIds);
  const totalQuestions = questions.length;
  const seenCount = questions.filter((q) => seenSet.has(q.id)).length;
  const coveragePct = totalQuestions > 0 ? Math.round((seenCount / totalQuestions) * 100) : 0;

  const avgAccuracy =
    testHistory.length > 0
      ? Math.round(
          testHistory.reduce((acc, t) => acc + t.accuracy, 0) / testHistory.length,
        )
      : 0;

  const bestScorePct =
    testHistory.length > 0
      ? Math.max(...testHistory.map((t) => Math.max(0, t.percentage)))
      : 0;

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-lg sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-indigo-200 ring-1 ring-white/15">
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              Official 2026 RRB Syllabus & Marking Scheme (-1/3 Negative)
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Crack RRB NTPC & Station Master 2026
            </h1>
            <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
              Practice weighted CBT-1 & CBT-2 mocks, master Station Master CBAT psycho
              batteries, track seen questions locally, and export detailed PDF scorecards.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => onStartPreset('cbt1')}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-400"
              >
                <Play className="h-4 w-4 fill-current" />
                Launch CBT-1 Mock
              </button>
              <button
                type="button"
                onClick={() => onStartPreset('cbt2')}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
              >
                <Target className="h-4 w-4" />
                Launch CBT-2 Mock
              </button>
              <button
                type="button"
                onClick={() => onStartPreset('cbat')}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-500/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
              >
                <BrainCircuit className="h-4 w-4" />
                Station Master CBAT
              </button>
            </div>
          </div>

          {/* Candidate Profile Quick Settings */}
          <div className="w-full rounded-xl bg-white/10 p-4 backdrop-blur-sm ring-1 ring-white/15 lg:w-80">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-200">
              <UserCheck className="h-4 w-4" />
              Candidate Profile (PDF Header)
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-300">
                  Aspirant Name
                </label>
                <input
                  type="text"
                  value={settings.candidateName}
                  onChange={(e) => onUpdateSettings({ candidateName: e.target.value })}
                  placeholder="Enter your name"
                  className="w-full rounded-lg border border-white/20 bg-slate-900/60 px-3 py-1.5 text-sm text-white placeholder-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">
                  Primary Target Stage
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['CBT-1', 'CBT-2', 'Station Master'] as ExamTag[]).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onUpdateSettings({ targetExam: tag })}
                      className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                        settings.targetExam === tag
                          ? 'bg-indigo-500 text-white'
                          : 'bg-slate-900/50 text-slate-300 hover:bg-slate-900/80'
                      }`}
                    >
                      {tag === 'Station Master' ? 'SM CBAT' : tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Previous Year Papers entry */}
      <button
        type="button"
        onClick={() => onNavigate('pyq')}
        className="flex w-full flex-col gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-sky-50 p-5 text-left shadow-xs transition hover:border-indigo-400 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Previous Year Papers — 49,000+ real questions (2016–2026)
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600 sm:text-sm">
              Year-wise mocks, original shift papers, questions asked again and again, with the
              exact exam date &amp; shift for every question.
            </p>
          </div>
        </div>
        <span className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white">
          Open PYQs <ArrowRight className="h-4 w-4" />
        </span>
      </button>

      {/* KPI Metrics */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Syllabus Coverage
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {seenCount}/{totalQuestions}
            </span>
            <span className="text-xs font-semibold text-emerald-600">{coveragePct}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${coveragePct}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tests Completed
            </span>
            <ClipboardList className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{testHistory.length}</div>
          <p className="mt-1 text-xs text-slate-500">
            {bookmarkedIds.length} bookmarked questions
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Avg Accuracy
            </span>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {testHistory.length > 0 ? `${avgAccuracy}%` : '—'}
          </div>
          <p className="mt-1 text-xs text-slate-500">Target ≥ 82% to beat -1/3 penalty</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Best Net Score
            </span>
            <Award className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {testHistory.length > 0 ? `${bestScorePct}%` : '—'}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            View PDF reports <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </section>

      {/* 4 Official Categories */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              2026 Syllabus Categories & Weightage
            </h2>
            <p className="text-sm text-slate-500">
              Click any section to start a targeted topic drill immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('bank')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Explore all {SYLLABUS.reduce((s, c) => s + c.subCategories.length, 0)}{' '}
            sub-topics <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {SYLLABUS.map((cat) => {
            const catQuestions = questions.filter((q) => q.category === cat.category);
            const catSeen = catQuestions.filter((q) => seenSet.has(q.id)).length;
            const pct =
              catQuestions.length > 0
                ? Math.round((catSeen / catQuestions.length) * 100)
                : 0;

            return (
              <div
                key={cat.category}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-indigo-300"
              >
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-900">{cat.category}</h3>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cat.badgeClass}`}
                    >
                      {cat.cbt1WeightLabel} | {cat.cbt2WeightLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    {cat.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {cat.subCategories.slice(0, 4).map((sub) => (
                      <span
                        key={sub}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                      >
                        {sub.split('(')[0].trim()}
                      </span>
                    ))}
                    {cat.subCategories.length > 4 && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        +{cat.subCategories.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
                    <span>
                      Seen: <strong>{catSeen}</strong> / {catQuestions.length} Qs
                    </span>
                    <span className="font-semibold">{pct}%</span>
                  </div>
                  <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: cat.accentHex }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onPracticeCategory(cat.category)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-600"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Practice {cat.shortName}
                    </button>
                    {cat.category === 'Station Master Special — CBAT' && (
                      <button
                        type="button"
                        onClick={() => onNavigate('cbat')}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                      >
                        Open Interactive CBAT Drills →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Exam Pattern Quick Reference */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">
          Official RRB 2026 Exam Structure Reference
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {EXAM_PATTERNS.map((pattern) => (
            <div
              key={pattern.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">{pattern.name}</h3>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                  {pattern.durationMinutes} min
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-rose-600">
                {pattern.negativeMarking}
              </p>
              <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
                {pattern.sections.map((sec) => (
                  <div
                    key={sec.name}
                    className="flex items-center justify-between py-2 text-xs"
                  >
                    <span className="text-slate-700">{sec.name}</span>
                    <span className="font-semibold text-slate-900">{sec.weightage}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
