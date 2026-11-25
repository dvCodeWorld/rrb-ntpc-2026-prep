export type QuestionType = 'mcq' | 'fill_in_blank';

export type ExamLanguage = 'both' | 'hi' | 'en';

export type ExamCategory =
  | 'General Awareness'
  | 'Mathematics'
  | 'General Intelligence & Reasoning'
  | 'Station Master Special — CBAT';

export type ExamTag = 'CBT-1' | 'CBT-2' | 'Station Master';

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
  | 'practice';

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
}

export interface ProgressStore {
  seenQuestionIds: string[];
  bookmarkedIds: string[];
  customQuestions: Question[];
  testHistory: TestAttempt[];
  settings: UserSettings;
}
