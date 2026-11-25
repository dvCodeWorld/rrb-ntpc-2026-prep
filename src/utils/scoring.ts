import { matchesSubCategory } from '../data/syllabus';
import type {
  CategoryScore,
  ExamCategory,
  ExamTag,
  Question,
  QuestionAttemptDetail,
  QuestionResponse,
  QuestionType,
  TestAttempt,
  TestConfig,
  TestMode,
} from '../types/exam';

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function prioritizeQuestions(
  pool: Question[],
  seenSet: Set<string>,
  prioritizeUnseen: boolean,
): Question[] {
  if (!prioritizeUnseen) {
    return shuffleArray(pool);
  }
  const unseen = shuffleArray(pool.filter((q) => !seenSet.has(q.id)));
  const seen = shuffleArray(pool.filter((q) => seenSet.has(q.id)));
  return [...unseen, ...seen];
}

export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/%$/, '')
    .trim();
}

export function isAnswerCorrect(question: Question, userAnswer: string): boolean {
  const trimmed = userAnswer.trim();
  if (!trimmed) return false;
  if (question.type === 'mcq') {
    return trimmed === question.correctAnswer;
  }
  const candidates = [question.correctAnswer, question.correctAnswerHi].filter(
    (c): c is string => Boolean(c && c.trim()),
  );
  const normUser = normalizeAnswer(trimmed);
  const numUser = Number(normUser);

  for (const candidate of candidates) {
    const normCorrect = normalizeAnswer(candidate);
    if (normUser === normCorrect) return true;
    const numCorrect = Number(normCorrect);
    if (
      !Number.isNaN(numUser) &&
      !Number.isNaN(numCorrect) &&
      normUser !== '' &&
      normCorrect !== '' &&
      Math.abs(numUser - numCorrect) < 1e-6
    ) {
      return true;
    }
  }
  return false;
}

export function buildPresetMockTest(
  preset: 'cbt1' | 'cbt2' | 'cbat',
  allQuestions: Question[],
  seenIds: string[],
  prioritizeUnseen: boolean,
  requestedCount?: number,
): TestConfig {
  const seenSet = new Set(seenIds);

  if (preset === 'cbat') {
    const cbatPool = prioritizeQuestions(
      allQuestions.filter((q) => q.category === 'Station Master Special — CBAT'),
      seenSet,
      prioritizeUnseen,
    );
    const selected = cbatPool.slice(0, requestedCount ?? cbatPool.length);
    return {
      id: `test_${Date.now()}`,
      title: 'Station Master CBAT (Psycho Battery Mock)',
      mode: 'cbat_mock',
      durationSeconds: Math.max(5, selected.length) * 90,
      negativeMarking: 0,
      marksPerQuestion: 1,
      instantFeedback: false,
      questionIds: selected.map((q) => q.id),
    };
  }

  // CBT-1 (40:30:30 ratio) or CBT-2 (50:35:35 ratio)
  const isCbt1 = preset === 'cbt1';
  const weights: Array<{ category: ExamCategory; ratio: number }> = isCbt1
    ? [
        { category: 'General Awareness', ratio: 0.4 },
        { category: 'Mathematics', ratio: 0.3 },
        { category: 'General Intelligence & Reasoning', ratio: 0.3 },
      ]
    : [
        { category: 'General Awareness', ratio: 50 / 120 },
        { category: 'Mathematics', ratio: 35 / 120 },
        { category: 'General Intelligence & Reasoning', ratio: 35 / 120 },
      ];

  const nonCbatQuestions = allQuestions.filter(
    (q) => q.category !== 'Station Master Special — CBAT',
  );
  const maxPossible = nonCbatQuestions.length;
  const targetTotal = Math.min(requestedCount ?? 30, maxPossible);

  const selectedIds: string[] = [];
  const usedIds = new Set<string>();

  for (const { category, ratio } of weights) {
    const desired = Math.max(1, Math.round(targetTotal * ratio));
    const catPool = prioritizeQuestions(
      nonCbatQuestions.filter((q) => q.category === category),
      seenSet,
      prioritizeUnseen,
    );
    for (const q of catPool.slice(0, desired)) {
      if (selectedIds.length < targetTotal && !usedIds.has(q.id)) {
        selectedIds.push(q.id);
        usedIds.add(q.id);
      }
    }
  }

  // Top up if rounding left fewer than targetTotal
  if (selectedIds.length < targetTotal) {
    const remaining = prioritizeQuestions(
      nonCbatQuestions.filter((q) => !usedIds.has(q.id)),
      seenSet,
      prioritizeUnseen,
    );
    for (const q of remaining) {
      if (selectedIds.length >= targetTotal) break;
      selectedIds.push(q.id);
      usedIds.add(q.id);
    }
  }

  // Official RRB pace: 90 mins for 100 Qs (CBT-1) = 54s/Q, 90 mins for 120 Qs (CBT-2) = 45s/Q
  const secPerQuestion = isCbt1 ? 54 : 45;

  return {
    id: `test_${Date.now()}`,
    title: isCbt1
      ? `RRB NTPC CBT-1 Mock (${selectedIds.length} Qs)`
      : `RRB NTPC CBT-2 Mock (${selectedIds.length} Qs)`,
    mode: isCbt1 ? 'cbt1_mock' : 'cbt2_mock',
    durationSeconds: Math.max(300, selectedIds.length * secPerQuestion),
    negativeMarking: 1 / 3,
    marksPerQuestion: 1,
    instantFeedback: false,
    questionIds: selectedIds,
  };
}

export interface CustomTestOptions {
  title: string;
  categories: ExamCategory[];
  subCategory?: string;
  examTags?: ExamTag[];
  questionType?: QuestionType | 'all';
  unseenOnly?: boolean;
  questionCount: number;
  timed: boolean;
  durationMinutes: number;
  negativeMarking: number;
  instantFeedback: boolean;
}

export function buildCustomTest(
  options: CustomTestOptions,
  allQuestions: Question[],
  seenIds: string[],
  prioritizeUnseen: boolean,
): TestConfig {
  const seenSet = new Set(seenIds);

  const filtered = allQuestions.filter((q) => {
    if (options.categories.length > 0 && !options.categories.includes(q.category)) {
      return false;
    }
    if (options.subCategory && options.subCategory !== 'all') {
      if (!matchesSubCategory(q.subCategory, options.subCategory)) {
        return false;
      }
    }
    if (options.examTags && options.examTags.length > 0) {
      if (!q.examTag.some((tag) => options.examTags!.includes(tag))) {
        return false;
      }
    }
    if (options.questionType && options.questionType !== 'all') {
      if (q.type !== options.questionType) return false;
    }
    if (options.unseenOnly && seenSet.has(q.id)) {
      return false;
    }
    return true;
  });

  const ordered = prioritizeQuestions(filtered, seenSet, prioritizeUnseen);
  const chosen = ordered.slice(0, Math.min(options.questionCount, ordered.length));
  const mode: TestMode = options.instantFeedback ? 'practice' : 'custom_mock';

  return {
    id: `test_${Date.now()}`,
    title: options.title || 'Custom Practice Set',
    mode,
    durationSeconds: options.timed ? Math.max(60, options.durationMinutes * 60) : 0,
    negativeMarking: options.negativeMarking,
    marksPerQuestion: 1,
    instantFeedback: options.instantFeedback,
    questionIds: chosen.map((q) => q.id),
  };
}

export function evaluateTestAttempt(
  config: TestConfig,
  questions: Question[],
  responses: Record<string, QuestionResponse>,
  timeTakenSeconds: number,
): TestAttempt {
  const categoryOrder: ExamCategory[] = [
    'General Awareness',
    'Mathematics',
    'General Intelligence & Reasoning',
    'Station Master Special — CBAT',
  ];

  const catAccumulator = new Map<
    ExamCategory,
    {
      total: number;
      attempted: number;
      correct: number;
      wrong: number;
      unattempted: number;
    }
  >();

  for (const cat of categoryOrder) {
    catAccumulator.set(cat, {
      total: 0,
      attempted: 0,
      correct: 0,
      wrong: 0,
      unattempted: 0,
    });
  }

  let attempted = 0;
  let correct = 0;
  let wrong = 0;
  let unattempted = 0;

  const details: QuestionAttemptDetail[] = questions.map((q) => {
    const resp = responses[q.id];
    const userAnswer = resp?.userAnswer?.trim() ?? '';
    const isAttempted = userAnswer.length > 0;
    const correctFlag = isAttempted ? isAnswerCorrect(q, userAnswer) : false;

    const catStats = catAccumulator.get(q.category)!;
    catStats.total += 1;

    if (!isAttempted) {
      unattempted += 1;
      catStats.unattempted += 1;
    } else {
      attempted += 1;
      catStats.attempted += 1;
      if (correctFlag) {
        correct += 1;
        catStats.correct += 1;
      } else {
        wrong += 1;
        catStats.wrong += 1;
      }
    }

    return {
      questionId: q.id,
      category: q.category,
      subCategory: q.subCategory,
      type: q.type,
      question: q.question,
      options: q.options,
      userAnswer,
      correctAnswer: q.correctAnswer,
      isCorrect: correctFlag,
      isAttempted,
      explanation: q.explanation,
      timeSpentSeconds: resp?.timeSpentSeconds ?? 0,
    };
  });

  const positiveMarks = round2(correct * config.marksPerQuestion);
  const negativeMarksDeducted = round2(wrong * config.negativeMarking);
  const netScore = round2(positiveMarks - negativeMarksDeducted);
  const maxScore = round2(questions.length * config.marksPerQuestion);
  const percentage = maxScore > 0 ? round2((netScore / maxScore) * 100) : 0;
  const accuracy = attempted > 0 ? round2((correct / attempted) * 100) : 0;

  const categoryBreakdown: CategoryScore[] = categoryOrder
    .map((cat) => {
      const s = catAccumulator.get(cat)!;
      if (s.total === 0) return null;
      const marks = round2(
        s.correct * config.marksPerQuestion - s.wrong * config.negativeMarking,
      );
      const catMax = round2(s.total * config.marksPerQuestion);
      const catAcc = s.attempted > 0 ? round2((s.correct / s.attempted) * 100) : 0;
      return {
        category: cat,
        total: s.total,
        attempted: s.attempted,
        correct: s.correct,
        wrong: s.wrong,
        unattempted: s.unattempted,
        marks,
        maxMarks: catMax,
        accuracy: catAcc,
      };
    })
    .filter((x): x is CategoryScore => x !== null);

  return {
    id: config.id,
    title: config.title,
    mode: config.mode,
    completedAt: new Date().toISOString(),
    durationSeconds: config.durationSeconds,
    timeTakenSeconds,
    totalQuestions: questions.length,
    attempted,
    correct,
    wrong,
    unattempted,
    positiveMarks,
    negativeMarksDeducted,
    netScore,
    maxScore,
    percentage,
    accuracy,
    negativeMarkingRate: config.negativeMarking,
    categoryBreakdown,
    details,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
