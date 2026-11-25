import baseQuestionsRaw from '../data/questions.json';
import type {
  ExamCategory,
  ExamTag,
  ProgressStore,
  Question,
  TestAttempt,
  UserSettings,
} from '../types/exam';

const STORAGE_KEY = 'rrb_ntpc_2026_prep_v1';

const DEFAULT_SETTINGS: UserSettings = {
  candidateName: 'RRB Aspirant',
  targetExam: 'Station Master',
  prioritizeUnseen: true,
  language: 'both',
};

const DEFAULT_STORE: ProgressStore = {
  seenQuestionIds: [],
  bookmarkedIds: [],
  customQuestions: [],
  testHistory: [],
  settings: DEFAULT_SETTINGS,
};

export const BASE_QUESTIONS: Question[] = baseQuestionsRaw as Question[];

export function loadProgressStore(): ProgressStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STORE, settings: { ...DEFAULT_SETTINGS } };
    const parsed = JSON.parse(raw) as Partial<ProgressStore>;
    return {
      seenQuestionIds: Array.isArray(parsed.seenQuestionIds) ? parsed.seenQuestionIds : [],
      bookmarkedIds: Array.isArray(parsed.bookmarkedIds) ? parsed.bookmarkedIds : [],
      customQuestions: Array.isArray(parsed.customQuestions) ? parsed.customQuestions : [],
      testHistory: Array.isArray(parsed.testHistory) ? parsed.testHistory : [],
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_STORE, settings: { ...DEFAULT_SETTINGS } };
  }
}

export function saveProgressStore(store: ProgressStore): void {
  // Full 100-question PYQ attempts (with Hindi text) are large; if the ~5 MB localStorage quota is
  // hit, keep everything else and drop the oldest test attempts until it fits.
  let history = store.testHistory;
  for (;;) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...store, testHistory: history }));
      return;
    } catch {
      if (history.length === 0) return; // nothing more we can trim
      history = history.slice(0, Math.floor(history.length * 0.75));
    }
  }
}

export function getAllQuestions(customQuestions: Question[]): Question[] {
  const map = new Map<string, Question>();
  for (const q of BASE_QUESTIONS) {
    map.set(q.id, q);
  }
  for (const q of customQuestions) {
    map.set(q.id, q);
  }
  return Array.from(map.values());
}

const VALID_CATEGORIES = new Set<ExamCategory>([
  'General Awareness',
  'Mathematics',
  'General Intelligence & Reasoning',
  'Station Master Special — CBAT',
]);

const VALID_TAGS = new Set<ExamTag>(['CBT-1', 'CBT-2', 'Station Master']);

export function validateQuestionsPayload(payload: unknown): {
  valid: Question[];
  errors: string[];
} {
  if (!Array.isArray(payload)) {
    return { valid: [], errors: ['JSON root must be an array of question objects.'] };
  }

  const valid: Question[] = [];
  const errors: string[] = [];

  payload.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push(`Item #${index + 1}: must be a JSON object.`);
      return;
    }
    const q = item as Record<string, unknown>;
    if (typeof q.id !== 'string' || !q.id.trim()) {
      errors.push(`Item #${index + 1}: missing valid string "id".`);
      return;
    }
    if (q.type !== 'mcq' && q.type !== 'fill_in_blank') {
      errors.push(`Item #${index + 1} (${q.id}): "type" must be "mcq" or "fill_in_blank".`);
      return;
    }
    if (typeof q.category !== 'string' || !VALID_CATEGORIES.has(q.category as ExamCategory)) {
      errors.push(`Item #${index + 1} (${q.id}): invalid "category".`);
      return;
    }
    if (typeof q.subCategory !== 'string' || !q.subCategory.trim()) {
      errors.push(`Item #${index + 1} (${q.id}): missing "subCategory".`);
      return;
    }
    if (typeof q.question !== 'string' || !q.question.trim()) {
      errors.push(`Item #${index + 1} (${q.id}): missing "question" text.`);
      return;
    }
    if (typeof q.correctAnswer !== 'string' || !q.correctAnswer.trim()) {
      errors.push(`Item #${index + 1} (${q.id}): missing "correctAnswer".`);
      return;
    }

    const options = Array.isArray(q.options)
      ? q.options.filter((o): o is string => typeof o === 'string')
      : [];
    if (q.type === 'mcq' && options.length < 2) {
      errors.push(`Item #${index + 1} (${q.id}): MCQ requires at least 2 options.`);
      return;
    }

    const rawTags = Array.isArray(q.examTag) ? q.examTag : ['CBT-1'];
    const examTag = rawTags.filter(
      (t): t is ExamTag => typeof t === 'string' && VALID_TAGS.has(t as ExamTag),
    );

    const optionsHi = Array.isArray(q.optionsHi)
      ? q.optionsHi.filter((o): o is string => typeof o === 'string')
      : undefined;

    valid.push({
      id: q.id.trim(),
      type: q.type,
      category: q.category as ExamCategory,
      subCategory: q.subCategory.trim(),
      examTag: examTag.length > 0 ? examTag : ['CBT-1'],
      question: q.question.trim(),
      questionHi: typeof q.questionHi === 'string' && q.questionHi.trim() ? q.questionHi.trim() : undefined,
      options,
      optionsHi: optionsHi && optionsHi.length === options.length ? optionsHi : undefined,
      correctAnswer: q.correctAnswer.trim(),
      correctAnswerHi:
        typeof q.correctAnswerHi === 'string' && q.correctAnswerHi.trim()
          ? q.correctAnswerHi.trim()
          : undefined,
      explanation:
        typeof q.explanation === 'string' && q.explanation.trim()
          ? q.explanation.trim()
          : 'No explanation provided.',
      explanationHi:
        typeof q.explanationHi === 'string' && q.explanationHi.trim()
          ? q.explanationHi.trim()
          : undefined,
    });
  });

  return { valid, errors };
}

export function addSeenIds(prev: string[], idsToAdd: string[]): string[] {
  const set = new Set(prev);
  for (const id of idsToAdd) set.add(id);
  return Array.from(set);
}

export function appendTestAttempt(
  history: TestAttempt[],
  attempt: TestAttempt,
): TestAttempt[] {
  return [attempt, ...history].slice(0, 50);
}
