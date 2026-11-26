import { useEffect, useMemo, useState } from 'react';
import { CbatLabView } from './components/CbatLabView';
import { DashboardView } from './components/DashboardView';
import { ExamSimulator } from './components/ExamSimulator';
import { HistoryView } from './components/HistoryView';
import { MockBuilderView } from './components/MockBuilderView';
import { PyqView } from './components/PyqView';
import { type ActiveTab, Navbar } from './components/Navbar';
import { QuestionBankView } from './components/QuestionBankView';
import { TestResultView } from './components/TestResultView';
import type {
  ExamCategory,
  ProgressStore,
  Question,
  TestAttempt,
  TestConfig,
  UserSettings,
} from './types/exam';
import {
  buildCustomTest,
  buildPresetMockTest,
  type CustomTestOptions,
} from './utils/scoring';
import {
  addSeenIds,
  appendTestAttempt,
  getAllQuestions,
  loadProgressStore,
  saveProgressStore,
} from './utils/storage';

export function App() {
  const [store, setStore] = useState<ProgressStore>(() => loadProgressStore());
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [activeTest, setActiveTest] = useState<TestConfig | null>(null);
  const [viewingAttempt, setViewingAttempt] = useState<TestAttempt | null>(null);
  // Previous-year questions loaded on demand (kept for the session so results can show images & sources)
  const [pyqQuestions, setPyqQuestions] = useState<Map<string, Question>>(() => new Map());

  useEffect(() => {
    saveProgressStore(store);
  }, [store]);

  const allQuestions = useMemo(
    () => getAllQuestions(store.customQuestions),
    [store.customQuestions],
  );

  const questionMap = useMemo(() => {
    const map = new Map<string, Question>(pyqQuestions);
    for (const q of allQuestions) map.set(q.id, q);
    return map;
  }, [allQuestions, pyqQuestions]);

  const activeTestQuestions = useMemo(() => {
    if (!activeTest) return [];
    return activeTest.questionIds
      .map((id) => questionMap.get(id))
      .filter((q): q is Question => Boolean(q));
  }, [activeTest, questionMap]);

  const handleUpdateSettings = (patch: Partial<UserSettings>) => {
    setStore((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
  };

  const handleToggleBookmark = (id: string) => {
    setStore((prev) => {
      const exists = prev.bookmarkedIds.includes(id);
      return {
        ...prev,
        bookmarkedIds: exists
          ? prev.bookmarkedIds.filter((b) => b !== id)
          : [...prev.bookmarkedIds, id],
      };
    });
  };

  const handleStartPreset = (preset: 'cbt1' | 'cbt2' | 'cbat', count?: number) => {
    const config = buildPresetMockTest(
      preset,
      allQuestions,
      store.seenQuestionIds,
      store.settings.prioritizeUnseen,
      count,
    );
    if (config.questionIds.length === 0) return;
    setViewingAttempt(null);
    setActiveTest(config);
  };

  const handleStartCustom = (options: CustomTestOptions) => {
    const config = buildCustomTest(
      options,
      allQuestions,
      store.seenQuestionIds,
      store.settings.prioritizeUnseen,
    );
    if (config.questionIds.length === 0) return;
    setViewingAttempt(null);
    setActiveTest(config);
  };

  const handlePracticeCategory = (category: ExamCategory) => {
    const count = allQuestions.filter((q) => q.category === category).length;
    handleStartCustom({
      title: `${category} Practice`,
      categories: [category],
      questionCount: count,
      timed: true,
      durationMinutes: Math.max(5, Math.ceil(count * 1.2)),
      negativeMarking: category === 'Station Master Special — CBAT' ? 0 : 1 / 3,
      instantFeedback: true,
    });
  };

  const handlePracticeIds = (title: string, questionIds: string[]) => {
    if (questionIds.length === 0) return;
    setViewingAttempt(null);
    setActiveTest({
      id: `test_${Date.now()}`,
      title,
      mode: 'practice',
      durationSeconds: 0,
      negativeMarking: 0,
      marksPerQuestion: 1,
      instantFeedback: true,
      questionIds,
    });
  };

  const handleStartPyqTest = (config: TestConfig, questions: Question[]) => {
    if (questions.length === 0) return;
    setPyqQuestions((prev) => {
      const next = new Map(prev);
      for (const q of questions) next.set(q.id, q);
      return next;
    });
    setViewingAttempt(null);
    setActiveTest(config);
  };

  const handleTestComplete = (attempt: TestAttempt, seenQuestionIds: string[]) => {
    setStore((prev) => ({
      ...prev,
      seenQuestionIds: addSeenIds(prev.seenQuestionIds, seenQuestionIds),
      testHistory: appendTestAttempt(prev.testHistory, attempt),
    }));
    setActiveTest(null);
    setViewingAttempt(attempt);
  };

  const handleImportQuestions = (newQuestions: Question[]) => {
    setStore((prev) => {
      const merged = new Map<string, Question>();
      for (const q of prev.customQuestions) merged.set(q.id, q);
      for (const q of newQuestions) merged.set(q.id, q);
      return {
        ...prev,
        customQuestions: Array.from(merged.values()),
      };
    });
  };

  // Fullscreen CBT Exam Simulator mode
  if (activeTest && activeTestQuestions.length > 0) {
    return (
      <ExamSimulator
        config={activeTest}
        questions={activeTestQuestions}
        bookmarkedIds={store.bookmarkedIds}
        language={store.settings.language}
        onChangeLanguage={(language) => handleUpdateSettings({ language })}
        onToggleBookmark={handleToggleBookmark}
        onComplete={handleTestComplete}
        onCancel={() => setActiveTest(null)}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setViewingAttempt(null);
          setActiveTab(tab);
        }}
        targetExam={store.settings.targetExam}
        seenCount={
          allQuestions.filter((q) => store.seenQuestionIds.includes(q.id)).length
        }
        totalCount={allQuestions.length}
        language={store.settings.language}
        onChangeLanguage={(language) => handleUpdateSettings({ language })}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {viewingAttempt ? (
          <TestResultView
            attempt={viewingAttempt}
            candidateName={store.settings.candidateName}
            language={store.settings.language}
            questionMap={questionMap}
            onBack={() => setViewingAttempt(null)}
            backLabel={
              activeTab === 'history' ? 'Back to Test History' : 'Back to Dashboard'
            }
          />
        ) : activeTab === 'dashboard' ? (
          <DashboardView
            questions={allQuestions}
            seenIds={store.seenQuestionIds}
            bookmarkedIds={store.bookmarkedIds}
            testHistory={store.testHistory}
            settings={store.settings}
            onUpdateSettings={handleUpdateSettings}
            onStartPreset={(preset) => handleStartPreset(preset)}
            onPracticeCategory={handlePracticeCategory}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        ) : activeTab === 'pyq' ? (
          <PyqView
            seenIds={store.seenQuestionIds}
            bookmarkedIds={store.bookmarkedIds}
            language={store.settings.language}
            prioritizeUnseen={store.settings.prioritizeUnseen}
            syllabus2026Mode={store.settings.syllabus2026Mode}
            onToggleSyllabus2026Mode={(on) => handleUpdateSettings({ syllabus2026Mode: on })}
            onStartTest={handleStartPyqTest}
            onToggleBookmark={handleToggleBookmark}
          />
        ) : activeTab === 'mock' ? (
          <MockBuilderView
            questions={allQuestions}
            seenIds={store.seenQuestionIds}
            prioritizeUnseen={store.settings.prioritizeUnseen}
            onTogglePrioritizeUnseen={(val) =>
              handleUpdateSettings({ prioritizeUnseen: val })
            }
            onStartPreset={handleStartPreset}
            onStartCustom={handleStartCustom}
          />
        ) : activeTab === 'bank' ? (
          <QuestionBankView
            questions={allQuestions}
            seenIds={store.seenQuestionIds}
            bookmarkedIds={store.bookmarkedIds}
            customQuestionCount={store.customQuestions.length}
            language={store.settings.language}
            onToggleBookmark={handleToggleBookmark}
            onPracticeQuestions={handlePracticeIds}
            onImportQuestions={handleImportQuestions}
          />
        ) : activeTab === 'cbat' ? (
          <CbatLabView onStartCbatMock={() => handleStartPreset('cbat')} />
        ) : (
          <HistoryView
            history={store.testHistory}
            seenCount={store.seenQuestionIds.length}
            candidateName={store.settings.candidateName}
            onViewAttempt={(att) => setViewingAttempt(att)}
            onDeleteAttempt={(id) =>
              setStore((prev) => ({
                ...prev,
                testHistory: prev.testHistory.filter((t) => t.id !== id),
              }))
            }
            onResetSeen={() =>
              setStore((prev) => ({
                ...prev,
                seenQuestionIds: [],
              }))
            }
            onClearHistory={() =>
              setStore((prev) => ({
                ...prev,
                testHistory: [],
              }))
            }
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        RRB NTPC &amp; Station Master 2026 Exam Prep • Local-first{' '}
        <code>questions.json</code> + <code>localStorage</code> • Client-side PDF
        Scorecard Export
      </footer>
    </div>
  );
}

export default App;
