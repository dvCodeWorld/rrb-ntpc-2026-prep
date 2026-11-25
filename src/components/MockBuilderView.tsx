import React, { useMemo, useState } from 'react';
import {
  BrainCircuit,
  Check,
  Clock,
  Filter,
  Play,
  SlidersHorizontal,
  Sparkles,
  Target,
} from 'lucide-react';
import { matchesSubCategory, SYLLABUS } from '../data/syllabus';
import type { ExamCategory, ExamTag, Question, QuestionType } from '../types/exam';
import type { CustomTestOptions } from '../utils/scoring';

interface MockBuilderViewProps {
  questions: Question[];
  seenIds: string[];
  prioritizeUnseen: boolean;
  onTogglePrioritizeUnseen: (val: boolean) => void;
  onStartPreset: (preset: 'cbt1' | 'cbt2' | 'cbat', count?: number) => void;
  onStartCustom: (options: CustomTestOptions) => void;
}

export const MockBuilderView: React.FC<MockBuilderViewProps> = ({
  questions,
  seenIds,
  prioritizeUnseen,
  onTogglePrioritizeUnseen,
  onStartPreset,
  onStartCustom,
}) => {
  const seenSet = useMemo(() => new Set(seenIds), [seenIds]);

  const [cbt1Count, setCbt1Count] = useState(20);
  const [cbt2Count, setCbt2Count] = useState(24);

  const [selectedCategories, setSelectedCategories] = useState<ExamCategory[]>([
    'General Awareness',
    'Mathematics',
    'General Intelligence & Reasoning',
  ]);
  const [subCategory, setSubCategory] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<ExamTag | 'all'>('all');
  const [questionType, setQuestionType] = useState<QuestionType | 'all'>('all');
  const [unseenOnly, setUnseenOnly] = useState(false);
  const [questionCount, setQuestionCount] = useState(15);
  const [timed, setTimed] = useState(true);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [instantFeedback, setInstantFeedback] = useState(false);
  const [enableNegative, setEnableNegative] = useState(true);

  const availableSubCategories = useMemo(() => {
    const subs: string[] = [];
    for (const meta of SYLLABUS) {
      if (selectedCategories.includes(meta.category)) {
        subs.push(...meta.subCategories);
      }
    }
    return subs;
  }, [selectedCategories]);

  const matchingCount = useMemo(() => {
    return questions.filter((q) => {
      if (selectedCategories.length > 0 && !selectedCategories.includes(q.category)) {
        return false;
      }
      if (subCategory !== 'all' && !matchesSubCategory(q.subCategory, subCategory)) {
        return false;
      }
      if (selectedTag !== 'all' && !q.examTag.includes(selectedTag)) {
        return false;
      }
      if (questionType !== 'all' && q.type !== questionType) {
        return false;
      }
      if (unseenOnly && seenSet.has(q.id)) {
        return false;
      }
      return true;
    }).length;
  }, [
    questions,
    selectedCategories,
    subCategory,
    selectedTag,
    questionType,
    unseenOnly,
    seenSet,
  ]);

  const nonCbatCount = useMemo(
    () => questions.filter((q) => q.category !== 'Station Master Special — CBAT').length,
    [questions],
  );
  const cbatCount = useMemo(
    () => questions.filter((q) => q.category === 'Station Master Special — CBAT').length,
    [questions],
  );

  const toggleCategory = (cat: ExamCategory) => {
    setSubCategory('all');
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  return (
    <div className="space-y-8">
      {/* Header + Unseen Toggle */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Mock Test & Custom Practice Generator
          </h1>
          <p className="text-sm text-slate-500">
            Official weighted RRB mock tests with authentic CBT palette, timer & -1/3 negative
            marking.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={prioritizeUnseen}
            onChange={(e) => onTogglePrioritizeUnseen(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
          Prioritize Unseen Questions First
        </label>
      </div>

      {/* Official Presets */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* CBT-1 */}
        <div className="flex flex-col justify-between rounded-2xl border border-indigo-200 bg-white p-6 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                CBT-1 SCREENING
              </span>
              <span className="font-mono text-xs text-slate-500">40:30:30 Ratio</span>
            </div>
            <h2 className="mt-3 text-lg font-bold text-slate-900">
              RRB NTPC CBT-1 Weighted Mock
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Generates a balanced test matching official CBT-1 weightage: 40% General
              Awareness, 30% Math, 30% Reasoning. Negative marking: -1/3.
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Question Count (Max {nonCbatCount})
              </label>
              <div className="flex gap-2">
                {[10, 20, 30, nonCbatCount].map((val, idx) => (
                  <button
                    key={`${val}-${idx}`}
                    type="button"
                    onClick={() => setCbt1Count(val)}
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition ${
                      cbt1Count === val
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {idx === 3 ? `All (${val})` : `${val} Qs`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onStartPreset('cbt1', cbt1Count)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <Play className="h-4 w-4 fill-current" />
            Start CBT-1 Mock
          </button>
        </div>

        {/* CBT-2 */}
        <div className="flex flex-col justify-between rounded-2xl border border-emerald-200 bg-white p-6 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                CBT-2 MAINS
              </span>
              <span className="font-mono text-xs text-slate-500">50:35:35 Ratio</span>
            </div>
            <h2 className="mt-3 text-lg font-bold text-slate-900">
              RRB NTPC CBT-2 Merit Mock
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Follows CBT-2Mains distribution (50 GA : 35 Math : 35 Reasoning) at 45 sec/Q
              pace with -1/3 negative marking.
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Question Count (Max {nonCbatCount})
              </label>
              <div className="flex gap-2">
                {[12, 24, 36, nonCbatCount].map((val, idx) => (
                  <button
                    key={`${val}-${idx}`}
                    type="button"
                    onClick={() => setCbt2Count(val)}
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition ${
                      cbt2Count === val
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {idx === 3 ? `All (${val})` : `${val} Qs`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onStartPreset('cbt2', cbt2Count)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            <Target className="h-4 w-4" />
            Start CBT-2 Mock
          </button>
        </div>

        {/* CBAT */}
        <div className="flex flex-col justify-between rounded-2xl border border-rose-200 bg-white p-6 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                STATION MASTER
              </span>
              <span className="font-mono text-xs text-slate-500">Zero Negative</span>
            </div>
            <h2 className="mt-3 text-lg font-bold text-slate-900">
              CBAT Aptitude Battery Mock
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Tests Track/Station Memory, Odd-Number Sum Selective Attention, Shortest Route
              Scanning, Information Ordering & Situational Judgment ({cbatCount} items).
            </p>
            <div className="mt-4 rounded-lg bg-rose-50/70 p-3 text-xs text-rose-800">
              Includes both MCQ and Fill-in-the-Blank psycho calculations. No negative
              marking.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onStartPreset('cbat')}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            <BrainCircuit className="h-4 w-4" />
            Start CBAT Battery ({cbatCount} Qs)
          </button>
        </div>
      </div>

      {/* Custom Practice Builder */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="h-5 w-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Custom Topic & Drill Builder
              </h2>
              <p className="text-xs text-slate-500">
                Mix categories, narrow down to a single sub-topic, or drill Fill-in-the-Blank
                questions.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {matchingCount} matching questions available
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Filters */}
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                1. Categories
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SYLLABUS.map((meta) => {
                  const selected = selectedCategories.includes(meta.category);
                  return (
                    <button
                      key={meta.category}
                      type="button"
                      onClick={() => toggleCategory(meta.category)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                        selected
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate pr-2">{meta.shortName}</span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Sub-Category
                </label>
                <select
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="all">All Selected Sub-Categories</option>
                  {availableSubCategories.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Exam Tag
                </label>
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value as ExamTag | 'all')}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="all">All Tags (CBT-1, CBT-2, SM)</option>
                  <option value="CBT-1">CBT-1</option>
                  <option value="CBT-2">CBT-2</option>
                  <option value="Station Master">Station Master</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                {(['all', 'mcq', 'fill_in_blank'] as const).map((qt) => (
                  <button
                    key={qt}
                    type="button"
                    onClick={() => setQuestionType(qt)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      questionType === qt
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {qt === 'all' ? 'All Types' : qt === 'mcq' ? 'MCQ' : 'Fill-in-Blank'}
                  </button>
                ))}
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={unseenOnly}
                  onChange={(e) => setUnseenOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                Unseen questions only
              </label>
            </div>
          </div>

          {/* Right: Timing & Mode */}
          <div className="flex flex-col justify-between space-y-4 rounded-xl bg-slate-50 p-4">
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold text-slate-700">
                  <span>Number of Questions</span>
                  <span>
                    {Math.min(questionCount, matchingCount)} / {matchingCount} available
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, matchingCount)}
                  value={Math.min(questionCount, Math.max(1, matchingCount))}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Clock className="h-4 w-4 text-indigo-600" />
                    Countdown Timer
                  </span>
                  <input
                    type="checkbox"
                    checked={timed}
                    onChange={(e) => setTimed(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                </label>

                {timed && (
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span className="text-xs font-semibold text-slate-700">Minutes</span>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={durationMinutes}
                      onChange={(e) =>
                        setDurationMinutes(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-16 rounded border border-slate-200 px-2 py-1 text-right font-mono text-xs font-semibold"
                    />
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-700">
                      Instant Feedback
                    </div>
                    <div className="text-[11px] text-slate-500">Study / check mode</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={instantFeedback}
                    onChange={(e) => setInstantFeedback(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-700">
                      -1/3 Negative Marking
                    </div>
                    <div className="text-[11px] text-slate-500">Official CBT penalty</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableNegative}
                    onChange={(e) => setEnableNegative(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                </label>
              </div>
            </div>

            <button
              type="button"
              disabled={matchingCount === 0}
              onClick={() =>
                onStartCustom({
                  title:
                    subCategory !== 'all'
                      ? `Practice: ${subCategory}`
                      : selectedCategories.length === 1
                        ? `${selectedCategories[0]} Practice`
                        : 'Custom Mixed RRB Practice',
                  categories: selectedCategories,
                  subCategory,
                  examTags: selectedTag === 'all' ? undefined : [selectedTag],
                  questionType,
                  unseenOnly,
                  questionCount: Math.min(questionCount, matchingCount),
                  timed,
                  durationMinutes,
                  negativeMarking: enableNegative ? 1 / 3 : 0,
                  instantFeedback,
                })
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="h-4 w-4 fill-current" />
              {matchingCount === 0
                ? 'No Questions Match Filters'
                : `Launch Custom Session (${Math.min(questionCount, matchingCount)} Qs)`}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
