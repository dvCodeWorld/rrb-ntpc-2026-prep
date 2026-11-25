import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Flag,
  Grid,
  HelpCircle,
  RotateCcw,
  Send,
  X,
  XCircle,
} from 'lucide-react';
import type {
  ExamCategory,
  ExamLanguage,
  Question,
  QuestionResponse,
  QuestionVisitStatus,
  TestAttempt,
  TestConfig,
} from '../types/exam';
import { evaluateTestAttempt, formatDuration, isAnswerCorrect } from '../utils/scoring';

interface ExamSimulatorProps {
  config: TestConfig;
  questions: Question[];
  bookmarkedIds: string[];
  language: ExamLanguage;
  onChangeLanguage: (lang: ExamLanguage) => void;
  onToggleBookmark: (id: string) => void;
  onComplete: (attempt: TestAttempt, seenQuestionIds: string[]) => void;
  onCancel: () => void;
}

export const ExamSimulator: React.FC<ExamSimulatorProps> = ({
  config,
  questions,
  bookmarkedIds,
  language,
  onChangeLanguage,
  onToggleBookmark,
  onComplete,
  onCancel,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>(() => {
    const initial: Record<string, QuestionResponse> = {};
    questions.forEach((q, idx) => {
      initial[q.id] = {
        questionId: q.id,
        userAnswer: '',
        status: idx === 0 ? 'not_answered' : 'not_visited',
        timeSpentSeconds: 0,
      };
    });
    return initial;
  });

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showMobilePalette, setShowMobilePalette] = useState(false);
  const [activeSectionFilter, setActiveSectionFilter] = useState<ExamCategory | 'All'>('All');

  const submittedRef = useRef(false);
  const responsesRef = useRef(responses);
  const elapsedRef = useRef(elapsedSeconds);

  useEffect(() => {
    responsesRef.current = responses;
    elapsedRef.current = elapsedSeconds;
  }, [responses, elapsedSeconds]);

  const currentQuestion = questions[currentIndex];
  const currentResponse = responses[currentQuestion.id];
  const isTimed = config.durationSeconds > 0;
  const remainingSeconds = isTimed
    ? Math.max(0, config.durationSeconds - elapsedSeconds)
    : 0;

  // Categories present in this test
  const sections = useMemo(() => {
    const seen = new Set<ExamCategory>();
    for (const q of questions) seen.add(q.category);
    return Array.from(seen);
  }, [questions]);

  const handleFinalSubmit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const attempt = evaluateTestAttempt(
      config,
      questions,
      responsesRef.current,
      elapsedRef.current,
    );
    const visitedIds = Object.values(responsesRef.current)
      .filter((r) => r.status !== 'not_visited')
      .map((r) => r.questionId);
    onComplete(attempt, visitedIds);
  };

  // Timer tick (counts total elapsed & per-question time)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (config.durationSeconds > 0 && next >= config.durationSeconds) {
          window.clearInterval(timer);
          setTimeout(() => handleFinalSubmit(), 0);
        }
        return next;
      });

      const qId = questions[currentIndex]?.id;
      if (qId) {
        setResponses((prev) => {
          const cur = prev[qId];
          if (!cur) return prev;
          return {
            ...prev,
            [qId]: { ...cur, timeSpentSeconds: cur.timeSpentSeconds + 1 },
          };
        });
      }
    }, 1000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, config.durationSeconds]);

  const jumpToQuestion = (targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const targetQ = questions[targetIdx];
    setResponses((prev) => {
      const targetResp = prev[targetQ.id];
      if (targetResp && targetResp.status === 'not_visited') {
        return {
          ...prev,
          [targetQ.id]: { ...targetResp, status: 'not_answered' },
        };
      }
      return prev;
    });
    setCurrentIndex(targetIdx);
    setShowMobilePalette(false);
  };

  const handleAnswerChange = (val: string) => {
    const qId = currentQuestion.id;
    setResponses((prev) => {
      const cur = prev[qId];
      const wasMarked =
        cur.status === 'marked_review' || cur.status === 'answered_marked';
      const hasVal = val.trim().length > 0;
      const nextStatus: QuestionVisitStatus = hasVal
        ? wasMarked
          ? 'answered_marked'
          : 'answered'
        : wasMarked
          ? 'marked_review'
          : 'not_answered';
      return {
        ...prev,
        [qId]: { ...cur, userAnswer: val, status: nextStatus },
      };
    });
  };

  const handleClearResponse = () => {
    const qId = currentQuestion.id;
    setResponses((prev) => ({
      ...prev,
      [qId]: { ...prev[qId], userAnswer: '', status: 'not_answered' },
    }));
  };

  const handleMarkForReviewAndNext = () => {
    const qId = currentQuestion.id;
    setResponses((prev) => {
      const cur = prev[qId];
      const hasVal = cur.userAnswer.trim().length > 0;
      return {
        ...prev,
        [qId]: {
          ...cur,
          status: hasVal ? 'answered_marked' : 'marked_review',
        },
      };
    });
    if (currentIndex < questions.length - 1) {
      jumpToQuestion(currentIndex + 1);
    }
  };

  const handleSaveAndNext = () => {
    const qId = currentQuestion.id;
    setResponses((prev) => {
      const cur = prev[qId];
      const hasVal = cur.userAnswer.trim().length > 0;
      return {
        ...prev,
        [qId]: {
          ...cur,
          status: hasVal ? 'answered' : 'not_answered',
        },
      };
    });
    if (currentIndex < questions.length - 1) {
      jumpToQuestion(currentIndex + 1);
    }
  };

  // Palette summary counts
  const counts = useMemo(() => {
    const res = {
      answered: 0,
      not_answered: 0,
      marked_review: 0,
      answered_marked: 0,
      not_visited: 0,
    };
    Object.values(responses).forEach((r) => {
      res[r.status] += 1;
    });
    return res;
  }, [responses]);

  const getPaletteButtonStyle = (status: QuestionVisitStatus, isCurrent: boolean) => {
    const ring = isCurrent ? 'ring-2 ring-slate-900 ring-offset-1' : '';
    switch (status) {
      case 'answered':
        return `bg-emerald-600 text-white border-emerald-600 ${ring}`;
      case 'not_answered':
        return `bg-rose-500 text-white border-rose-500 ${ring}`;
      case 'marked_review':
        return `bg-purple-600 text-white border-purple-600 ${ring}`;
      case 'answered_marked':
        return `bg-purple-700 text-white border-emerald-400 ring-2 ring-emerald-400 ${
          isCurrent ? 'ring-offset-1' : ''
        }`;
      default:
        return `bg-slate-100 text-slate-700 border-slate-300 ${ring}`;
    }
  };

  const isBookmarked = bookmarkedIds.includes(currentQuestion.id);
  const isRevealed = Boolean(revealedIds[currentQuestion.id]);
  const instantIsCorrect = isAnswerCorrect(currentQuestion, currentResponse.userAnswer);

  const filteredQuestionIndices = useMemo(() => {
    return questions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => activeSectionFilter === 'All' || q.category === activeSectionFilter);
  }, [questions, activeSectionFilter]);

  const PalettePanel = (
    <div className="flex h-full flex-col justify-between bg-white">
      <div>
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">Question Palette</h3>
          <p className="text-xs text-slate-500">Official TCS iON / RRB Status Grid</p>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-slate-50 p-3 text-[11px] font-medium text-slate-700">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-600 text-[10px] font-bold text-white">
              {counts.answered}
            </span>
            Answered
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-rose-500 text-[10px] font-bold text-white">
              {counts.not_answered}
            </span>
            Not Answered
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-200 text-[10px] font-bold text-slate-700">
              {counts.not_visited}
            </span>
            Not Visited
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-purple-600 text-[10px] font-bold text-white">
              {counts.marked_review}
            </span>
            Marked
          </div>
          <div className="col-span-2 flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-purple-700 text-[10px] font-bold text-white ring-2 ring-emerald-400">
              {counts.answered_marked}
            </span>
            Answered & Marked for Review
          </div>
        </div>

        {/* Grid */}
        <div className="max-h-[45vh] overflow-y-auto p-4 lg:max-h-[52vh]">
          <div className="grid grid-cols-5 gap-2">
            {filteredQuestionIndices.map(({ q, idx }) => {
              const resp = responses[q.id];
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => jumpToQuestion(idx)}
                  className={`h-9 rounded-lg border text-xs font-bold transition ${getPaletteButtonStyle(
                    resp.status,
                    idx === currentIndex,
                  )}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 p-4">
        <button
          type="button"
          onClick={() => setShowSubmitModal(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <Send className="h-4 w-4" />
          Submit Exam
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* Top CBT Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold sm:text-base">{config.title}</h1>
            <p className="text-[11px] text-slate-400">
              Q {currentIndex + 1} of {questions.length} •{' '}
              {config.negativeMarking > 0
                ? 'Marking: +1.00 / -0.33'
                : 'No Negative Marking'}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Bilingual Language Switcher */}
            <div className="inline-flex rounded-lg border border-slate-700 bg-slate-800 p-0.5 text-[11px] font-bold">
              {(
                [
                  { id: 'both', label: 'हिं+EN' },
                  { id: 'hi', label: 'हिंदी' },
                  { id: 'en', label: 'EN' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeLanguage(opt.id)}
                  className={`rounded-md px-2 py-1 transition ${
                    language === opt.id
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs font-bold sm:text-sm ${
                isTimed && remainingSeconds <= 120
                  ? 'animate-pulse bg-rose-600 text-white'
                  : 'bg-slate-800 text-emerald-400'
              }`}
            >
              <Clock className="h-4 w-4" />
              {isTimed ? formatDuration(remainingSeconds) : formatDuration(elapsedSeconds)}
            </div>

            <button
              type="button"
              onClick={() => setShowMobilePalette(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 lg:hidden"
            >
              <Grid className="h-4 w-4" />
              Palette
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Exit
            </button>
          </div>
        </div>
      </header>

      {/* Section Tabs */}
      {sections.length > 1 && (
        <div className="border-b border-slate-200 bg-white px-4 py-2">
          <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-xs font-semibold text-slate-500">Sections:</span>
            <button
              type="button"
              onClick={() => setActiveSectionFilter('All')}
              className={`shrink-0 rounded-lg px-3 py-1 text-xs font-semibold ${
                activeSectionFilter === 'All'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All ({questions.length})
            </button>
            {sections.map((sec) => {
              const firstIdx = questions.findIndex((q) => q.category === sec);
              const secCount = questions.filter((q) => q.category === sec).length;
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    setActiveSectionFilter(sec);
                    if (firstIdx >= 0) jumpToQuestion(firstIdx);
                  }}
                  className={`shrink-0 rounded-lg px-3 py-1 text-xs font-semibold ${
                    currentQuestion.category === sec
                      ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {sec} ({secCount})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 lg:grid-cols-[1fr_310px]">
        {/* Question Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="p-5 sm:p-7">
            {/* Meta Header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white">
                  Q.{currentIndex + 1}
                </span>
                <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                  {currentQuestion.category}
                </span>
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {currentQuestion.subCategory}
                </span>
                <span className="rounded-md border border-slate-200 px-2 py-0.5 font-mono text-[11px] text-slate-500">
                  {currentQuestion.type === 'mcq' ? 'MCQ' : 'FILL IN BLANK'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onToggleBookmark(currentQuestion.id)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  isBookmarked
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Bookmark className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                {isBookmarked ? 'Saved' : 'Bookmark'}
              </button>
            </div>

            {/* Question Stem */}
            <div className="space-y-2">
              {(language === 'hi' || language === 'both') && currentQuestion.questionHi && (
                <p className="text-base font-semibold leading-relaxed text-slate-900 sm:text-lg">
                  {currentQuestion.questionHi}
                </p>
              )}
              {(language === 'en' || language === 'both' || !currentQuestion.questionHi) && (
                <p
                  className={
                    language === 'both' && currentQuestion.questionHi
                      ? 'border-l-2 border-indigo-200 pl-3 text-sm font-medium leading-relaxed text-slate-600 sm:text-base'
                      : 'text-base font-semibold leading-relaxed text-slate-900 sm:text-lg'
                  }
                >
                  {currentQuestion.question}
                </p>
              )}
            </div>

            {/* Input Area */}
            <div className="mt-6">
              {currentQuestion.type === 'mcq' ? (
                <div className="space-y-3">
                  {currentQuestion.options.map((opt, i) => {
                    const isSelected = currentResponse.userAnswer === opt;
                    const letter = String.fromCharCode(65 + i);
                    const optHi = currentQuestion.optionsHi?.[i];
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleAnswerChange(opt)}
                        className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-950 ring-1 ring-indigo-600'
                            : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 bg-slate-50 text-slate-600'
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="flex flex-col pt-0.5 leading-snug">
                          {(language === 'hi' || language === 'both') && optHi && (
                            <span>{optHi}</span>
                          )}
                          {(language === 'en' ||
                            !optHi ||
                            (language === 'both' && optHi !== opt)) && (
                            <span
                              className={
                                language === 'both' && optHi && optHi !== opt
                                  ? 'mt-0.5 text-xs font-normal text-slate-500'
                                  : ''
                              }
                            >
                              {opt}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Type Your Exact Answer (Number or Word)
                  </label>
                  <input
                    type="text"
                    value={currentResponse.userAnswer}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    placeholder="Enter answer here..."
                    className="w-full max-w-md rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-base font-semibold text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Case-insensitive matching; trailing spaces and extra % signs are handled
                    automatically.
                  </p>
                </div>
              )}
            </div>

            {/* Study Mode Instant Feedback */}
            {config.instantFeedback && (
              <div className="mt-6">
                {!isRevealed ? (
                  <button
                    type="button"
                    onClick={() =>
                      setRevealedIds((prev) => ({ ...prev, [currentQuestion.id]: true }))
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                  >
                    <Eye className="h-4 w-4" />
                    Check Answer & Explanation
                  </button>
                ) : (
                  <div
                    className={`rounded-xl border p-4 ${
                      instantIsCorrect
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-rose-200 bg-rose-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-bold">
                      {instantIsCorrect ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span className="text-emerald-800">Correct!</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-rose-600" />
                          <span className="text-rose-800">
                            {language === 'hi' && currentQuestion.correctAnswerHi
                              ? `सही उत्तर: ${currentQuestion.correctAnswerHi}`
                              : language === 'both' &&
                                  currentQuestion.correctAnswerHi &&
                                  currentQuestion.correctAnswerHi !==
                                    currentQuestion.correctAnswer
                                ? `Correct Answer: ${currentQuestion.correctAnswerHi} (${currentQuestion.correctAnswer})`
                                : `Correct Answer: ${currentQuestion.correctAnswer}`}
                          </span>
                        </>
                      )}
                    </div>
                    {(language === 'hi' || language === 'both') &&
                      currentQuestion.explanationHi && (
                        <p className="mt-2 text-xs leading-relaxed text-slate-700">
                          <strong>व्याख्या:</strong> {currentQuestion.explanationHi}
                        </p>
                      )}
                    {(language === 'en' ||
                      language === 'both' ||
                      !currentQuestion.explanationHi) && (
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                        <strong>Explanation:</strong> {currentQuestion.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => jumpToQuestion(currentIndex - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={handleClearResponse}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear
              </button>
              <button
                type="button"
                onClick={handleMarkForReviewAndNext}
                className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-800 hover:bg-purple-100"
              >
                <Flag className="h-3.5 w-3.5" />
                Mark & Next
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveAndNext}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
              >
                {currentIndex === questions.length - 1 ? 'Save Response' : 'Save & Next'}
                {currentIndex < questions.length - 1 && (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 lg:hidden"
              >
                Submit
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Sidebar Palette */}
        <aside className="hidden overflow-hidden rounded-2xl border border-slate-200 shadow-xs lg:block">
          {PalettePanel}
        </aside>
      </div>

      {/* Mobile Palette Drawer */}
      {showMobilePalette && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 lg:hidden">
          <div className="relative h-full w-80 max-w-full bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setShowMobilePalette(false)}
              className="absolute top-3 right-3 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Close palette"
            >
              <X className="h-5 w-5" />
            </button>
            {PalettePanel}
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Submit Mock Test?
                </h2>
                <p className="text-xs text-slate-500">
                  Review your question status summary before final submission.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Answered:</span>
                <strong className="text-emerald-700">
                  {counts.answered + counts.answered_marked}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Not Answered:</span>
                <strong className="text-rose-600">{counts.not_answered}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Marked Only:</span>
                <strong className="text-purple-700">{counts.marked_review}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Not Visited:</span>
                <strong className="text-slate-700">{counts.not_visited}</strong>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg bg-indigo-50 p-2.5 text-[11px] text-indigo-800">
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Note: Questions marked as &ldquo;Answered &amp; Marked for Review&rdquo; ARE
                evaluated for final scoring per official RRB rules.
              </span>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Resume Test
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Confirm & Generate Scorecard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
