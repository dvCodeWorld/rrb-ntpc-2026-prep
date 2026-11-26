export type QuestionType = 'mcq' | 'fill_in_blank';

export type ExamLanguage = 'both' | 'hi' | 'en';

export type ExamCategory =
  | 'General Awareness'
  | 'Mathematics'
  | 'General Intelligence & Reasoning'
  | 'Station Master Special — CBAT';

export type ExamTag = 'CBT-1' | 'CBT-2' | 'Station Master';

/** Where a previous-year question (PYQ) was asked, as read from the original RRB papers. */
export interface QuestionSource {
  /** Number of distinct exam sittings (date + shift) this question appeared in. */
  repeatCount: number;
  /** Human-readable exam sittings, e.g. "CBT-1 · 11 Jan 2021 · Shift 2 (3:00 PM)". */
  askedIn: string[];
  years: number[];
  /** Text was read by OCR from an image/scan; compare with the image if something looks off. */
  ocr?: boolean;
  /** Section was inferred by the text classifier (the paper did not label it). */
  sectionInferred?: boolean;
  /** Note printed in the source paper (e.g. question dropped by RRB). */
  note?: string;
  /** 2026 syllabus sub-topic guessed from keywords (approximate). */
  topic2026?: string;
  /** General Awareness question whose answer depends on when it was asked (office holders, events, rankings). */
  timeSensitive?: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  category: ExamCategory;
  subCategory: string;
  examTag: ExamTag[];
  question: string;
  questionHi?: string;
  options: string[];
  optionsHi?: string[];
  correctAnswer: string;
  correctAnswerHi?: string;
  explanation: string;
  explanationHi?: string;
  /** Diagram / formula / scan images that belong to the question (URLs). */
  images?: string[];
  /** One image list per option (same order as options). */
  optionImages?: string[][];
  /** Shared passage / table text shown above the question (comprehension sets). */
  passage?: string;
  passageImages?: string[];
  /** Present for previous-year questions. */
  source?: QuestionSource;
}

export type QuestionVisitStatus =
  | 'not_visited'
  | 'not_answered'
  | 'answered'
  | 'marked_review'
  | 'answered_marked';

export interface QuestionResponse {
  questionId: string;
  userAnswer: string;
  status: QuestionVisitStatus;
  timeSpentSeconds: number;
}

export type TestMode =
  | 'cbt1_mock'
  | 'cbt2_mock'
  | 'cbat_mock'
  | 'custom_mock'
  | 'practice'
  | 'pyq_mock'
  | 'pyq_paper';

export interface TestConfig {
  id: string;
  title: string;
  mode: TestMode;
  durationSeconds: number;
  negativeMarking: number; // e.g. 1/3 for CBT-1 & CBT-2, 0 for CBAT/Practice
  marksPerQuestion: number;
  instantFeedback: boolean;
  questionIds: string[];
}

export interface CategoryScore {
  category: ExamCategory;
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  marks: number;
  maxMarks: number;
  accuracy: number;
}

export interface QuestionAttemptDetail {
  questionId: string;
  category: ExamCategory;
  subCategory: string;
  type: QuestionType;
  question: string;
  options: string[];
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  isAttempted: boolean;
  explanation: string;
  timeSpentSeconds: number;
  /** PYQ only: exam sittings this question was asked in. */
  askedIn?: string[];
}

export interface TestAttempt {
  id: string;
  title: string;
  mode: TestMode;
  completedAt: string;
  durationSeconds: number;
  timeTakenSeconds: number;
  totalQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  positiveMarks: number;
  negativeMarksDeducted: number;
  netScore: number;
  maxScore: number;
  percentage: number;
  accuracy: number;
  negativeMarkingRate: number;
  categoryBreakdown: CategoryScore[];
  details: QuestionAttemptDetail[];
}

export interface UserSettings {
  candidateName: string;
  targetExam: ExamTag;
  prioritizeUnseen: boolean;
  language: ExamLanguage;
  /** 2026 syllabus mode: recent papers by default, hide outdated current-affairs PYQs. */
  syllabus2026Mode: boolean;
}

export interface ProgressStore {
  seenQuestionIds: string[];
  bookmarkedIds: string[];
  customQuestions: Question[];
  testHistory: TestAttempt[];
  settings: UserSettings;
}
