# Architecture & Technical Memory (`docs/ARCHITECTURE.md`)

> **Applies to:** `rrb-ntpc-2026-prep`  
> **Last Verified:** `2026-11-26`

---

## 1. High-Level Application Flow

[`src/App.tsx`](../src/App.tsx) owns the single persisted `ProgressStore` state (loaded synchronously on mount via `loadProgressStore()` and synced back via `useEffect` -> `saveProgressStore()`).

```
App (ProgressStore in localStorage)
 ├── activeTest !== null ──► Fullscreen <ExamSimulator />
 │                              └── onComplete(attempt, seenIds)
 │                                     ├── updates seenQuestionIds + testHistory
 │                                     └── opens <TestResultView />
 └── activeTest === null ──► Standard Layout (<Navbar /> + main + footer)
                                ├── viewingAttempt !== null ──► <TestResultView />
                                ├── tab: "dashboard" ──► <DashboardView />
                                ├── tab: "pyq"       ──► <PyqView />  (loads public/pyq lazily; starts tests via onStartTest)
                                ├── tab: "mock"      ──► <MockBuilderView />
                                ├── tab: "bank"      ──► <QuestionBankView />
                                ├── tab: "cbat"      ──► <CbatLabView />
                                └── tab: "history"   ──► <HistoryView />
```

---

## 2. Core Data Contracts ([`src/types/exam.ts`](../src/types/exam.ts))

- **`Question`**:
  - `id: string` (unique, e.g. `RRB_MATH_001`)
  - `type: 'mcq' | 'fill_in_blank'`
  - `category: ExamCategory` (one of the 4 official categories)
  - `subCategory: string`
  - `examTag: ExamTag[]` (`'CBT-1' | 'CBT-2' | 'Station Master'`)
  - `question: string` and optional `questionHi?: string`
  - `options: string[]` (`>= 2` strings for `mcq`; `[]` for `fill_in_blank`) and optional `optionsHi?: string[]` (same length & order as `options`)
  - `correctAnswer: string` and optional `correctAnswerHi?: string`
  - `explanation: string` and optional `explanationHi?: string`
  - Optional (PYQ): `images?`, `optionImages?` (per option), `passage?`, `passageImages?`, `source?: QuestionSource` (`repeatCount`, `askedIn` labels, `years`, `ocr`, `sectionInferred`, `note`)
- **`TestMode`** adds `'pyq_mock' | 'pyq_paper'`; `QuestionAttemptDetail.askedIn?` keeps PYQ exam shifts with each attempt.
- **Previous Year Questions** are not in `questions.json`; see [`PYQ_BANK.md`](PYQ_BANK.md). `App.tsx` keeps loaded PYQs in session state `pyqQuestions` and merges them into `questionMap`.
- **`ProgressStore`** (persisted under `localStorage` key `rrb_ntpc_2026_prep_v1`):
  - `seenQuestionIds: string[]` — IDs of questions visited (not `not_visited`) during submitted exams/practice.
  - `bookmarkedIds: string[]` — User-saved question IDs.
  - `customQuestions: Question[]` — Validated user-imported questions merged over `BASE_QUESTIONS` by ID.
  - `testHistory: TestAttempt[]` — Capped at the 50 most recent attempts (`appendTestAttempt`). If the ~5 MB `localStorage` quota is hit, `saveProgressStore` drops the oldest attempts until the store fits.
  - `settings: UserSettings` — `{ candidateName, targetExam, prioritizeUnseen, language, syllabus2026Mode }` (`language` defaults to `'both'`; `syllabus2026Mode` defaults to `true` and is filled in for old stores by `loadProgressStore()`'s default merge).

### Deployment Architecture
- `vite.config.ts` sets `base: './'` for portable static hosting.
- `.github/workflows/deploy.yml` builds (`npm ci && npm run build`) and deploys `dist/` to GitHub Pages (`https://dvcodeworld.github.io/rrb-ntpc-2026-prep/`) on every push to `main`.

---

## 3. Scoring, Test Generation & Normalization ([`src/utils/scoring.ts`](../src/utils/scoring.ts))

### Mock Test Generators
1. **`buildPresetMockTest(preset, allQuestions, seenIds, prioritizeUnseen, requestedCount)`**
   - `cbt1`: Uses `40%` General Awareness, `30%` Mathematics, `30%` Reasoning from non-CBAT pool; `54 sec/question` (min `300s`); `negativeMarking = 1/3`.
   - `cbt2`: Uses `50/120` General Awareness, `35/120` Mathematics, `35/120` Reasoning from non-CBAT pool; `45 sec/question` (min `300s`); `negativeMarking = 1/3`.
   - `cbat`: Uses all `Station Master Special — CBAT` questions; `90 sec/question` (min `450s`); `negativeMarking = 0`.
2. **`buildCustomTest(options, allQuestions, seenIds, prioritizeUnseen)`**
   - Filters by `categories`, `subCategory` (via `matchesSubCategory`), `examTags`, `questionType`, and `unseenOnly`.
   - Supports timed/untimed, `instantFeedback` (study mode), and optional `-1/3` negative marking.
3. **Unseen Prioritization (`prioritizeQuestions`)**:
   - When `prioritizeUnseen === true`, shuffles unseen questions first, followed by shuffled seen questions.

### Answer Checking (`isAnswerCorrect`)
- **`mcq`:** Exact string match `userAnswer.trim() === question.correctAnswer`.
- **`fill_in_blank`:** `normalizeAnswer()` lowercases, trims, collapses internal whitespace, and strips a trailing `%`. If both parse as finite numbers (`!Number.isNaN`), checks `Math.abs(numUser - numCorrect) < 1e-6` (e.g., `17.0` matches `17`).

### Evaluation (`evaluateTestAttempt`)
- `positiveMarks = round2(correct * marksPerQuestion)`
- `negativeMarksDeducted = round2(wrong * negativeMarking)`
- `netScore = round2(positiveMarks - negativeMarksDeducted)`
- `accuracy = attempted > 0 ? round2((correct / attempted) * 100) : 0`
- Note: Questions marked `answered_marked` (Answered & Marked for Review) **are evaluated** per official RRB CBT rules.

---

## 4. Client-Side PDF Export Pipeline ([`src/utils/pdfExport.ts`](../src/utils/pdfExport.ts))

`exportAttemptToPdf(attempt, candidateName)` builds an A4 portrait PDF entirely in the browser. It is loaded on demand through [`pdfLazy.ts`](../src/utils/pdfLazy.ts) (`downloadAttemptPdf`) so the ~430 kB PDF engine is not part of the initial bundle. Answer-key cells containing non-Latin-1 text (Hindi, ₹, √) are drawn on a canvas by [`pdfText.ts`](../src/utils/pdfText.ts) and embedded as JPEG images, because jsPDF's built-in fonts cannot shape Devanagari. PYQ rows also list the exam shifts the question was asked in:
1. Dark slate/indigo header banner with candidate name and formatted `IN` timestamp.
2. 4-column KPI summary box (`Net Score`, `Accuracy`, `Negative Penalty`, `Time & Attempt`).
3. Section-wise performance table via `autoTable(doc, ...)`.
4. Complete Answer Key & Explanations table via `autoTable(doc, ...)` with `didParseCell` status coloring (`Correct` green, `Wrong` red, `Skipped` slate).
5. Page footer numbering (`Page X of Y`) and automatic download `rrb-2026-<slug>.pdf`.

---

## 5. Interactive CBAT Psycho Lab ([`src/components/CbatLabView.tsx`](../src/components/CbatLabView.tsx))
Standalone timed/interactive drills supplementing `questions.json`:
1. **Track / Station Memory:** 12-second memorization grid of 5 random Station–Platform pairs followed by recall prompt.
2. **Selective Attention (Sum of Odd Numbers):** Dynamically generated 9-number rows with instant odd-sum verification and streak counter.
3. **Spatial Scanning:** Interactive SVG yard network with a blocked segment (`X`) where the user identifies the shortest open path.
