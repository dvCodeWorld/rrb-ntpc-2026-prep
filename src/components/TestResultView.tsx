import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  MinusCircle,
  Trophy,
  XCircle,
} from 'lucide-react';
import type { ExamLanguage, Question, TestAttempt } from '../types/exam';
import { exportAttemptToPdf } from '../utils/pdfExport';
import { formatDuration } from '../utils/scoring';

interface TestResultViewProps {
  attempt: TestAttempt;
  candidateName: string;
  language: ExamLanguage;
  questionMap: Map<string, Question>;
  onBack: () => void;
  backLabel?: string;
}

export const TestResultView: React.FC<TestResultViewProps> = ({
  attempt,
  candidateName,
  language,
  questionMap,
  onBack,
  backLabel = 'Back to Dashboard',
}) => {
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'correct' | 'wrong' | 'skipped'
  >('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const filteredDetails = useMemo(() => {
    return attempt.details.filter((d) => {
      if (statusFilter === 'correct' && !d.isCorrect) return false;
      if (statusFilter === 'wrong' && (!d.isAttempted || d.isCorrect)) return false;
      if (statusFilter === 'skipped' && d.isAttempted) return false;
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
      return true;
    });
  }, [attempt.details, statusFilter, categoryFilter]);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>

        <button
          type="button"
          onClick={() => exportAttemptToPdf(attempt, candidateName)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <Download className="h-4 w-4" />
          Download PDF Scorecard & Answer Key
        </button>
      </div>

      {/* Result Banner */}
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-6 text-white shadow-md">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-indigo-200">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              Test Evaluation Complete
            </span>
            <h1 className="mt-2 text-xl font-extrabold sm:text-2xl">{attempt.title}</h1>
            <p className="mt-1 text-xs text-slate-300">
              Candidate: {candidateName || 'RRB Aspirant'} • Completed{' '}
              {new Date(attempt.completedAt).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-6 py-4 text-center backdrop-blur-sm ring-1 ring-white/15">
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
              Net Score
            </div>
            <div className="mt-1 text-3xl font-extrabold">
              {attempt.netScore}{' '}
              <span className="text-base font-medium text-slate-300">
                / {attempt.maxScore}
              </span>
            </div>
            <div className="mt-0.5 text-xs font-semibold text-emerald-300">
              {attempt.percentage}% Overall
            </div>
          </div>
        </div>
      </section>

      {/* Breakdown Cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
            <span>Correct Answers</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{attempt.correct}</div>
          <p className="mt-1 text-xs text-emerald-700">+{attempt.positiveMarks} marks</p>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-700">
            <span>Incorrect Answers</span>
            <XCircle className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{attempt.wrong}</div>
          <p className="mt-1 text-xs text-rose-700">
            -{attempt.negativeMarksDeducted} penalty
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>Unattempted</span>
            <MinusCircle className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {attempt.unattempted}
          </div>
          <p className="mt-1 text-xs text-slate-500">Accuracy: {attempt.accuracy}%</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>Time Taken</span>
            <Clock className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900">
            {formatDuration(attempt.timeTakenSeconds)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {attempt.attempted}/{attempt.totalQuestions} attempted
          </p>
        </div>
      </section>

      {/* Section Performance Table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">
            Section-Wise Performance
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Category</th>
                <th className="px-4 py-3 text-center">Qs</th>
                <th className="px-4 py-3 text-center">Correct</th>
                <th className="px-4 py-3 text-center">Wrong</th>
                <th className="px-4 py-3 text-center">Skipped</th>
                <th className="px-4 py-3 text-center">Marks</th>
                <th className="px-5 py-3 text-right">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attempt.categoryBreakdown.map((sec) => (
                <tr key={sec.category} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5 font-semibold text-slate-900">
                    {sec.category}
                  </td>
                  <td className="px-4 py-3.5 text-center text-slate-600">{sec.total}</td>
                  <td className="px-4 py-3.5 text-center font-semibold text-emerald-700">
                    {sec.correct}
                  </td>
                  <td className="px-4 py-3.5 text-center font-semibold text-rose-600">
                    {sec.wrong}
                  </td>
                  <td className="px-4 py-3.5 text-center text-slate-500">
                    {sec.unattempted}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono font-semibold text-slate-900">
                    {sec.marks} / {sec.maxMarks}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-indigo-700">
                    {sec.accuracy}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detailed Solutions & Answer Key */}
      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
          <h2 className="text-base font-bold text-slate-900">
            Detailed Answer Key & Explanations ({filteredDetails.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'correct', 'wrong', 'skipped'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  statusFilter === tab
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
            {attempt.categoryBreakdown.length > 1 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
              >
                <option value="all">All Categories</option>
                {attempt.categoryBreakdown.map((c) => (
                  <option key={c.category} value={c.category}>
                    {c.category}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {filteredDetails.map((item, idx) => {
            const fullQ = questionMap.get(item.questionId);
            return (
              <div
                key={`${item.questionId}-${idx}`}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                      {item.questionId}
                    </span>
                    <span className="text-xs font-semibold text-indigo-700">
                      {item.category}
                    </span>
                    <span className="text-xs text-slate-500">• {item.subCategory}</span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      !item.isAttempted
                        ? 'bg-slate-100 text-slate-600'
                        : item.isCorrect
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {!item.isAttempted
                      ? 'Unattempted'
                      : item.isCorrect
                        ? 'Correct (+1)'
                        : `Wrong (-${attempt.negativeMarkingRate > 0 ? '0.33' : '0'})`}
                  </span>
                </div>

                <div className="mt-3 space-y-1">
                  {(language === 'hi' || language === 'both') && fullQ?.questionHi && (
                    <p className="text-sm font-semibold text-slate-900">{fullQ.questionHi}</p>
                  )}
                  {(language === 'en' || language === 'both' || !fullQ?.questionHi) && (
                    <p
                      className={
                        language === 'both' && fullQ?.questionHi
                          ? 'text-xs font-medium text-slate-600'
                          : 'text-sm font-semibold text-slate-900'
                      }
                    >
                      {item.question}
                    </p>
                  )}
                </div>

                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <span className="font-semibold text-slate-500">Your Answer: </span>
                    <span
                      className={`font-bold ${
                        !item.isAttempted
                          ? 'text-slate-400'
                          : item.isCorrect
                            ? 'text-emerald-700'
                            : 'text-rose-600'
                      }`}
                    >
                      {item.isAttempted ? item.userAnswer : 'Not Attempted'}
                    </span>
                  </div>
                  <div className="rounded-lg bg-emerald-50/60 px-3 py-2">
                    <span className="font-semibold text-emerald-800">Correct Answer: </span>
                    <span className="font-bold text-emerald-900">
                      {(language === 'hi' || language === 'both') && fullQ?.correctAnswerHi
                        ? fullQ.correctAnswerHi
                        : item.correctAnswer}
                      {language === 'both' &&
                        fullQ?.correctAnswerHi &&
                        fullQ.correctAnswerHi !== item.correctAnswer &&
                        ` (${item.correctAnswer})`}
                    </span>
                  </div>
                </div>

                <div className="mt-3 space-y-1 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 text-xs leading-relaxed text-slate-700">
                  {(language === 'hi' || language === 'both') && fullQ?.explanationHi && (
                    <p>
                      <strong className="text-indigo-900">व्याख्या: </strong>
                      {fullQ.explanationHi}
                    </p>
                  )}
                  {(language === 'en' || language === 'both' || !fullQ?.explanationHi) && (
                    <p>
                      <strong className="text-indigo-900">Explanation: </strong>
                      {item.explanation}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
