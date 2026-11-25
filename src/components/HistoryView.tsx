import React from 'react';
import {
  Calendar,
  Download,
  Eye,
  RotateCcw,
  Trash2,
  Trophy,
} from 'lucide-react';
import type { TestAttempt } from '../types/exam';
import { downloadAttemptPdf } from '../utils/pdfLazy';
import { formatDuration } from '../utils/scoring';

interface HistoryViewProps {
  history: TestAttempt[];
  seenCount: number;
  candidateName: string;
  onViewAttempt: (attempt: TestAttempt) => void;
  onDeleteAttempt: (id: string) => void;
  onResetSeen: () => void;
  onClearHistory: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  seenCount,
  candidateName,
  onViewAttempt,
  onDeleteAttempt,
  onResetSeen,
  onClearHistory,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Test History & PDF Scorecards
          </h1>
          <p className="text-sm text-slate-500">
            All attempts and {seenCount} seen question IDs are persisted locally in{' '}
            <code>localStorage</code>.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={seenCount === 0}
            onClick={onResetSeen}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Seen ({seenCount})
          </button>
          <button
            type="button"
            disabled={history.length === 0}
            onClick={onClearHistory}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear History
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Trophy className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-3 text-base font-bold text-slate-800">
            No completed tests yet
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Complete a CBT-1, CBT-2, CBAT, or custom practice test to view detailed
            analytics and download PDF scorecards.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((attempt) => (
            <div
              key={attempt.id}
              className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{attempt.title}</h3>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                    {attempt.netScore} / {attempt.maxScore} ({attempt.percentage}%)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(attempt.completedAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                  <span>• Accuracy: {attempt.accuracy}%</span>
                  <span>
                    • {attempt.correct}C / {attempt.wrong}W / {attempt.unattempted}S
                  </span>
                  <span>• Time: {formatDuration(attempt.timeTakenSeconds)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onViewAttempt(attempt)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Review Key
                </button>
                <button
                  type="button"
                  onClick={() => void downloadAttemptPdf(attempt, candidateName)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  PDF Scorecard
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteAttempt(attempt.id)}
                  className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Delete attempt"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
