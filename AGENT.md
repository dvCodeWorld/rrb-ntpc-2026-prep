# AGENT.md — Project Memory & Engineering Guide

> **Canonical AI Agent Memory** for **RRB NTPC & RRB Station Master 2026** Exam Prep & CBT Simulator.  
> **Last Verified Against Live Web Sources:** `2026-11-25`  
> **Workspace Root:** `C:\Users\divya\.gemini\antigravity\scratch\rrb-ntpc-2026-prep`

---

## 1. Mission & Product Scope
This is a local-first, production-grade **React + TypeScript + Tailwind CSS** web application for **RRB NTPC (CEN 06/2026 / Classic CBT-1 & CBT-2)** and **RRB Station Master (Level-6, CEN 08/2026 & CBAT)** preparation.

Core capabilities:
1. Structured local question bank in [`src/data/questions.json`](src/data/questions.json) supporting both `mcq` and `fill_in_blank` items.
2. Official 4-category / 45-sub-category RRB syllabus taxonomy in [`src/data/syllabus.ts`](src/data/syllabus.ts).
3. Client-side persistence in `localStorage` (`rrb_ntpc_2026_prep_v1`) for seen question IDs, bookmarks, custom imported JSON questions, test history, and candidate settings.
4. Authentic TCS iON–style CBT Exam Simulator with countdown timer, section switcher, 5-state Question Palette, and `-1/3` negative marking (`0` for CBAT/Study mode).
5. Interactive Station Master CBAT Psycho Lab (Track/Station Memory, Sum of Odd Numbers, Spatial Shortest Route).
6. Client-side **PDF Scorecard & Complete Answer Key** generator using `jspdf` + `jspdf-autotable`.

---

## 2. Tech Stack & Build Invariants
- **Framework:** React `19.3.1`, TypeScript `~7.0.2`, Vite `8.3.6`
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite` plugin in `vite.config.ts`, `@import "tailwindcss";` in `src/index.css`)
- **Icons:** `lucide-react`
- **PDF Engine:** `jspdf` + `jspdf-autotable` (`autoTable(doc, options)` ESM default export)
- **Linter:** `oxlint` (includes React Compiler rules)

### Critical Compiler & Linter Rules (DO NOT VIOLATE)
1. **`verbatimModuleSyntax: true` is enabled:** All TypeScript type/interface imports MUST use `import type { ... }` or inline `type` modifiers (`import { type Foo }`). Failure breaks `tsc -b`.
2. **React Compiler / `oxlint` purity:**
   - Do **not** call `setState` synchronously inside a `useEffect` body (perform phase transitions inside timer/event callbacks).
   - Do **not** read or mutate `ref.current` during render; sync refs inside `useEffect`.
3. **PowerShell on Windows:** Use `;` (not `&&`) when chaining shell commands in `run_command`.

### Standard Verification Commands
Run after any code, syllabus, or `questions.json` edit:
```powershell
npm run build
npm run lint
node -e "const qs = require('./src/data/questions.json'); const ids = new Set(qs.map(q=>q.id)); const badMcq = qs.filter(q=>q.type==='mcq' && !q.options.includes(q.correctAnswer)); const badBlank = qs.filter(q=>q.type==='fill_in_blank' && q.options.length !== 0); console.log({total: qs.length, uniqueIds: ids.size, badMcq: badMcq.map(q=>q.id), badBlank: badBlank.map(q=>q.id)});"
```
Expected baseline (as of `2026-11-25`): `npm run build` exits 0, `npm run lint` reports `0 warnings and 0 errors`, and `questions.json` reports `{ total: 86, uniqueIds: 86, badMcq: [], badBlank: [] }`.

---

## 3. Repository Map & Memory Docs
| Path | Purpose |
| :--- | :--- |
| [`AGENT.md`](AGENT.md) | Primary AI agent memory, invariants, and update protocol (this file) |
| [`docs/EXAM_SPEC_2026.md`](docs/EXAM_SPEC_2026.md) | Web-verified 2026 RRB NTPC & Station Master exam rules, dates, CBAT T-score 42, A-2 medical, and question audit |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Module architecture, `localStorage` schema, scoring formulas, and PDF export pipeline |
| [`docs/DATA_MAINTENANCE.md`](docs/DATA_MAINTENANCE.md) | Step-by-step instructions to update exam specs, syllabus, and `questions.json` |
| [`src/types/exam.ts`](src/types/exam.ts) | Canonical TypeScript interfaces (`Question`, `TestConfig`, `TestAttempt`, `ProgressStore`) |
| [`src/data/syllabus.ts`](src/data/syllabus.ts) | 4 official categories, 45 sub-categories, `EXAM_PATTERNS`, and `matchesSubCategory()` |
| [`src/data/questions.json`](src/data/questions.json) | Master local question bank (86 verified questions: 30 GA, 25 Math, 20 Reasoning, 11 CBAT) |
| [`src/utils/storage.ts`](src/utils/storage.ts) | `localStorage` persistence (`rrb_ntpc_2026_prep_v1`) + `validateQuestionsPayload()` |
| [`src/utils/scoring.ts`](src/utils/scoring.ts) | Preset/custom mock generators, unseen prioritization, answer normalization, `-1/3` scoring |
| [`src/utils/pdfExport.ts`](src/utils/pdfExport.ts) | Client-side PDF scorecard & answer key export |
| [`src/App.tsx`](src/App.tsx) | Root state container, view router, fullscreen CBT Simulator switch |
| [`src/components/`](src/components) | `Navbar`, `DashboardView`, `MockBuilderView`, `ExamSimulator`, `TestResultView`, `QuestionBankView`, `CbatLabView`, `HistoryView` |

---

## 4. Verified Domain Snapshot (Quick Reference)
Full details and sources are stored in [`docs/EXAM_SPEC_2026.md`](docs/EXAM_SPEC_2026.md). Key facts every agent must respect:

- **App Syllabus Categories (4):**
  1. `General Awareness` — `40% weightage in CBT-1` (40/100 Qs) | `50% in CBT-2` (50/120 Qs), 9 sub-categories.
  2. `Mathematics` — `30% weightage in CBT-1` (30/100 Qs) | `35% in CBT-2` (35/120 Qs), 15 sub-categories.
  3. `General Intelligence & Reasoning` — `30% weightage in CBT-1` (30/100 Qs) | `35% in CBT-2` (35/120 Qs), 16 sub-categories.
  4. `Station Master Special — CBAT` — 5 sub-categories (`Memory Test`, `Selective Attention`, `Spatial Scanning`, `Information Ordering`, `Personality/Situational Judgment`).
- **Two Active 2026 RRB Recruitment Tracks Verified on `2026-11-25`:**
  - **CEN 06/2026 (NTPC Graduate):** 3,548 vacancies; tentative CBT-1 start in 4th week of December 2026; CBT-1 (100 Qs, 90 min, `-1/3`) & CBT-2 (120 Qs, 90 min, `-1/3`); CBTST (typing test) dispensed with for typist-related graduate posts under CEN 06/2026.
  - **CEN 08/2026 (Standalone Station Master, Pay Level-6):** 1,265 vacancies; notification Oct 26, 2026; applications Oct 27 – Nov 25, 2026; correction Nov 28 – Dec 7, 2026. Uses a **100-MCQ / 120-min Single-Stage CBT** (Basic Science & Math 30, Data Analysis & Interpretation 30, Logical Capability + English RC 20, Mental Reasoning 20; no separate GA section) + **CBAT** (5 batteries / 6 scores, **0 negative marking**, **min T-Score 42 in every battery with no category relaxation**, **70% CBT + 30% CBAT** final merit) + **A-2 Medical Standard**.
- **Note on App Coverage:** The UI currently implements the classic CBT-1 (`40:30:30`), CBT-2 (`50:35:35`), and Station Master CBAT presets plus a Custom Builder. If asked to support **CEN 08/2026 Single-Stage Station Master** as a separate preset, add a `cen08_sm` preset in `scoring.ts` and `MockBuilderView.tsx` without removing classic `cbt1`/`cbt2`/`cbat`.

---

## 5. Mandatory Protocol: Updating Memory & Data When New Info Arrives

Whenever the user provides new RRB notifications/dates/questions OR asks you to refresh exam data:

### Step 1 — Verify Before Writing
- Search official / reputable sources (`search_web`) for any new CEN numbers, revised exam dates, vacancy counts, syllabus/weightage changes, CBAT battery changes, or current affairs updates.
- Never overwrite verified facts with unverified assumptions. Record the verification date (`YYYY-MM-DD`) and source summary.

### Step 2 — Update Domain Memory First
- Update [`docs/EXAM_SPEC_2026.md`](docs/EXAM_SPEC_2026.md) with the new verified facts, dates, or rule changes (and note what changed in its Changelog section).
- Update [`AGENT.md`](AGENT.md) Section 4 ("Verified Domain Snapshot") and question counts if totals or exam tracks changed.

### Step 3 — Update Code & Data Files (Only What Changed)
- **If syllabus categories/sub-categories or exam patterns changed:** update [`src/data/syllabus.ts`](src/data/syllabus.ts) (`SYLLABUS`, `EXAM_PATTERNS`) and check `MockBuilderView.tsx` / `DashboardView.tsx` / `scoring.ts` for hardcoded ratios or durations.
- **If adding or correcting questions:** edit [`src/data/questions.json`](src/data/questions.json) following the strict schema in [`docs/DATA_MAINTENANCE.md`](docs/DATA_MAINTENANCE.md). Keep IDs unique (`RRB_GA_###`, `RRB_MATH_###`, `RRB_REAS_###`, `RRB_CBAT_###`) and keep `options: []` for `fill_in_blank`.
- **If updating `localStorage` structure:** preserve backward compatibility in `loadProgressStore()` inside [`src/utils/storage.ts`](src/utils/storage.ts) so existing user `seenQuestionIds` and `testHistory` never break; only bump `STORAGE_KEY` if a breaking migration is written.

### Step 4 — Update Architecture & Maintenance Docs if Structure Changed
- If new files, components, `TestMode` variants, or storage keys were added, update [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`AGENT.md`](AGENT.md) Section 3.

### Step 5 — Mandatory Verification Gate
Run all three checks before concluding:
1. `npm run build` (`tsc -b && vite build`) — must pass with 0 errors.
2. `npm run lint` (`oxlint`) — must pass with 0 errors and 0 warnings.
3. `questions.json` integrity check — verify JSON parses cleanly, all `id`s are unique, all `mcq` `correctAnswer`s exist verbatim in `options`, and all `fill_in_blank` items have `options: []`.
