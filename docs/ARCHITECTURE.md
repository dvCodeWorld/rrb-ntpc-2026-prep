# Architecture & Technical Memory (`docs/ARCHITECTURE.md`)

> **Applies to:** `rrb-ntpc-2026-prep`  
> **Last Verified:** `2026-11-25`

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
  - `question: string`
  - `options: string[]` (`>= 2` strings for `mcq`; `[]` for `fill_in_blank`)
  - `correctAnswer: string`
  - `explanation: string`
- **`ProgressStore`** (persisted under `localStorage` key `rrb_ntpc_2026_prep_v1`):
  - `seenQuestionIds: string[]` — IDs of questions visited (not `not_visited`) during submitted exams/practice.
  - `bookmarkedIds: string[]` — User-saved question IDs.
  - `customQuestions: Question[]` — Validated user-imported questions merged over `BASE_QUESTIONS` by ID.
  - `testHistory: TestAttempt[]` — Capped at the 50 most recent attempts (`appendTestAttempt`).
  - `settings: UserSettings` — `{ candidateName, targetExam, prioritizeUnseen }`.

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

`exportAttemptToPdf(attempt, candidateName)` builds an A4 portrait PDF entirely in the browser:
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
