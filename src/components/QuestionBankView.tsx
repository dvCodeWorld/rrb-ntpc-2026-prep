import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  Code2,
  Download,
  Eye,
  EyeOff,
  Play,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { matchesSubCategory, SYLLABUS } from '../data/syllabus';
import type {
  ExamCategory,
  ExamLanguage,
  ExamTag,
  Question,
  QuestionType,
} from '../types/exam';
import { validateQuestionsPayload } from '../utils/storage';

interface QuestionBankViewProps {
  questions: Question[];
  seenIds: string[];
  bookmarkedIds: string[];
  customQuestionCount: number;
  language: ExamLanguage;
  onToggleBookmark: (id: string) => void;
  onPracticeQuestions: (title: string, questionIds: string[]) => void;
  onImportQuestions: (newQuestions: Question[]) => void;
}

const SAMPLE_SCHEMA_TEMPLATE = `[
  {
    "id": "RRB_CUSTOM_001",
    "type": "mcq",
    "category": "Mathematics",
    "subCategory": "Time, Speed & Distance",
    "examTag": ["CBT-1", "CBT-2", "Station Master"],
    "question": "A train 200m long crosses a 300m bridge in 25 seconds. Find its speed in km/hr.",
    "options": ["72 km/hr", "60 km/hr", "54 km/hr", "80 km/hr"],
    "correctAnswer": "72 km/hr",
    "explanation": "Total distance = 500m. Speed = 500/25 = 20 m/s = 20 * (18/5) = 72 km/hr."
  }
]`;

export const QuestionBankView: React.FC<QuestionBankViewProps> = ({
  questions,
  seenIds,
  bookmarkedIds,
  customQuestionCount,
  language,
  onToggleBookmark,
  onPracticeQuestions,
  onImportQuestions,
}) => {
  const seenSet = useMemo(() => new Set(seenIds), [seenIds]);
  const bookmarkSet = useMemo(() => new Set(bookmarkedIds), [bookmarkedIds]);

  const [selectedCategory, setSelectedCategory] = useState<ExamCategory | 'All'>('All');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('All');
  const [selectedTag, setSelectedTag] = useState<ExamTag | 'All'>('All');
  const [selectedType, setSelectedType] = useState<QuestionType | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'unseen' | 'seen' | 'bookmarked'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedMap, setRevealedMap] = useState<Record<string, boolean>>({});

  // JSON Importer Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [jsonInput, setJsonInput] = useState(SAMPLE_SCHEMA_TEMPLATE);
  const [importFeedback, setImportFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const subCategoriesForSelect = useMemo(() => {
    if (selectedCategory === 'All') {
      return SYLLABUS.flatMap((c) => c.subCategories);
    }
    return (
      SYLLABUS.find((c) => c.category === selectedCategory)?.subCategories ?? []
    );
  }, [selectedCategory]);

  const filteredQuestions = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    return questions.filter((q) => {
      if (selectedCategory !== 'All' && q.category !== selectedCategory) return false;
      if (
        selectedSubCategory !== 'All' &&
        !matchesSubCategory(q.subCategory, selectedSubCategory)
      ) {
        return false;
      }
      if (selectedTag !== 'All' && !q.examTag.includes(selectedTag)) return false;
      if (selectedType !== 'All' && q.type !== selectedType) return false;
      if (statusFilter === 'unseen' && seenSet.has(q.id)) return false;
      if (statusFilter === 'seen' && !seenSet.has(q.id)) return false;
      if (statusFilter === 'bookmarked' && !bookmarkSet.has(q.id)) return false;

      if (qLower) {
        const hay = `${q.id} ${q.question} ${q.questionHi ?? ''} ${q.subCategory} ${q.category}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });
  }, [
    questions,
    selectedCategory,
    selectedSubCategory,
    selectedTag,
    selectedType,
    statusFilter,
    searchQuery,
    seenSet,
    bookmarkSet,
  ]);

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(questions, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'questions.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setJsonInput(reader.result);
        setImportFeedback(null);
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const { valid, errors } = validateQuestionsPayload(parsed);
      if (valid.length === 0) {
        setImportFeedback({
          ok: false,
          message: errors[0] || 'No valid questions found in JSON payload.',
        });
        return;
      }
      onImportQuestions(valid);
      setImportFeedback({
        ok: true,
        message: `Imported ${valid.length} question(s) into localStorage.${
          errors.length > 0 ? ` (${errors.length} skipped)` : ''
        }`,
      });
    } catch (err) {
      setImportFeedback({
        ok: false,
        message: err instanceof Error ? err.message : 'Invalid JSON syntax.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:flex-row lg:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Official 2026 Syllabus & Question Bank
          </h1>
          <p className="text-sm text-slate-500">
            {questions.length} total questions ({customQuestionCount} custom imported) •
            Browse, bookmark, study explanations, or expand{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
              questions.json
            </code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export questions.json
          </button>
          <button
            type="button"
            onClick={() => {
              setImportFeedback(null);
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            Add / Import JSON
          </button>
          {filteredQuestions.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onPracticeQuestions(
                  selectedSubCategory !== 'All'
                    ? `Drill: ${selectedSubCategory}`
                    : selectedCategory !== 'All'
                      ? `Drill: ${selectedCategory}`
                      : 'Filtered Bank Drill',
                  filteredQuestions.map((q) => q.id),
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Practice Filtered ({filteredQuestions.length})
            </button>
          )}
        </div>
      </div>

      {/* Category Pills + Subcategory Coverage */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setSelectedCategory('All');
            setSelectedSubCategory('All');
          }}
          className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            selectedCategory === 'All'
              ? 'bg-indigo-600 text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          All Categories ({questions.length})
        </button>
        {SYLLABUS.map((cat) => {
          const count = questions.filter((q) => q.category === cat.category).length;
          return (
            <button
              key={cat.category}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.category);
                setSelectedSubCategory('All');
              }}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                selectedCategory === cat.category
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {cat.shortName} ({count})
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by keyword, ID (e.g. RRB_MATH_001), or topic..."
            className="w-full rounded-lg border border-slate-200 py-2 pr-3 pl-9 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <select
          value={selectedSubCategory}
          onChange={(e) => setSelectedSubCategory(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
        >
          <option value="All">All Sub-Categories ({subCategoriesForSelect.length})</option>
          {subCategoriesForSelect.map((sub) => (
            <option key={sub} value={sub}>
              {sub}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value as ExamTag | 'All')}
            className="w-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
          >
            <option value="All">All Exams</option>
            <option value="CBT-1">CBT-1</option>
            <option value="CBT-2">CBT-2</option>
            <option value="Station Master">Station Master</option>
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as QuestionType | 'All')}
            className="w-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
          >
            <option value="All">All Types</option>
            <option value="mcq">MCQ</option>
            <option value="fill_in_blank">Fill Blank</option>
          </select>
        </div>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as 'all' | 'unseen' | 'seen' | 'bookmarked')
          }
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
        >
          <option value="all">Status: All</option>
          <option value="unseen">Unseen Only</option>
          <option value="seen">Seen Only</option>
          <option value="bookmarked">Bookmarked ({bookmarkedIds.length})</option>
        </select>
      </div>

      {/* Question Cards */}
      {filteredQuestions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No questions match your current filters.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Try clearing the search query or switching sub-category filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuestions.map((q) => {
            const isSeen = seenSet.has(q.id);
            const isBookmarked = bookmarkSet.has(q.id);
            const isRevealed = Boolean(revealedMap[q.id]);
            return (
              <div
                key={q.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                      {q.id}
                    </span>
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                      {q.category}
                    </span>
                    <span className="text-xs font-medium text-slate-600">
                      {q.subCategory}
                    </span>
                    <span className="rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                      {q.type === 'mcq' ? 'MCQ' : 'FILL-IN-BLANK'}
                    </span>
                    {isSeen && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Seen
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {q.examTag.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => onToggleBookmark(q.id)}
                      className={`rounded-lg border p-1.5 transition ${
                        isBookmarked
                          ? 'border-amber-300 bg-amber-50 text-amber-600'
                          : 'border-slate-200 text-slate-400 hover:text-slate-700'
                      }`}
                      aria-label="Toggle bookmark"
                    >
                      <Bookmark
                        className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-current' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  {(language === 'hi' || language === 'both') && q.questionHi && (
                    <p className="text-sm font-semibold leading-relaxed text-slate-900">
                      {q.questionHi}
                    </p>
                  )}
                  {(language === 'en' || language === 'both' || !q.questionHi) && (
                    <p
                      className={
                        language === 'both' && q.questionHi
                          ? 'text-xs font-medium leading-relaxed text-slate-600'
                          : 'text-sm font-semibold leading-relaxed text-slate-900'
                      }
                    >
                      {q.question}
                    </p>
                  )}
                </div>

                {q.type === 'mcq' && q.options.length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {q.options.map((opt, idx) => {
                      const highlight = isRevealed && opt === q.correctAnswer;
                      const optHi = q.optionsHi?.[idx];
                      return (
                        <div
                          key={opt}
                          className={`rounded-lg border px-3 py-2 text-xs ${
                            highlight
                              ? 'border-emerald-500 bg-emerald-50 font-bold text-emerald-900'
                              : 'border-slate-200 bg-slate-50/70 text-slate-700'
                          }`}
                        >
                          <span className="mr-1.5 font-bold">
                            {String.fromCharCode(65 + idx)}.
                          </span>
                          {(language === 'hi' || language === 'both') && optHi ? optHi : opt}
                          {language === 'both' && optHi && optHi !== opt && (
                            <span className="ml-1 text-[11px] font-normal text-slate-500">
                              ({opt})
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setRevealedMap((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    {isRevealed ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" /> Hide Answer & Explanation
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5" /> Show Answer & Explanation
                      </>
                    )}
                  </button>
                </div>

                {isRevealed && (
                  <div className="mt-3 space-y-1 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-slate-700">
                    <div className="font-bold text-emerald-800">
                      Answer:{' '}
                      {(language === 'hi' || language === 'both') && q.correctAnswerHi
                        ? q.correctAnswerHi
                        : q.correctAnswer}
                      {language === 'both' &&
                        q.correctAnswerHi &&
                        q.correctAnswerHi !== q.correctAnswer && (
                          <span className="ml-1 font-normal text-emerald-700">
                            ({q.correctAnswer})
                          </span>
                        )}
                    </div>
                    {(language === 'hi' || language === 'both') && q.explanationHi && (
                      <p className="leading-relaxed">{q.explanationHi}</p>
                    )}
                    {(language === 'en' || language === 'both' || !q.explanationHi) && (
                      <p className="leading-relaxed text-slate-600">{q.explanation}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Import / Expand JSON Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Expand Question Bank (questions.json Schema)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-600">
                  Paste a JSON array matching the official schema or upload a{' '}
                  <code>.json</code> file. Imported questions persist in{' '}
                  <code>localStorage</code>.
                </p>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                  <Upload className="h-3.5 w-3.5" />
                  Load .json file
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <textarea
                rows={12}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-emerald-300 focus:border-indigo-500 focus:outline-none"
              />

              {importFeedback && (
                <div
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                    importFeedback.ok
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {importFeedback.message}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleImportSubmit}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Validate & Import Questions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
