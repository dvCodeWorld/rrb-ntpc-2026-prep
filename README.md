# RRB NTPC & Station Master 2026 — Bilingual Exam Prep & CBT Simulator

A responsive, bilingual (**Hindi + English**), local-first React + TypeScript + Tailwind CSS preparation suite tailored for **RRB NTPC (CBT-1 & CBT-2)** and **RRB Station Master (Level-6 & CBAT)**.

- **Live App (Phone & Desktop):** https://dvcodeworld.github.io/rrb-ntpc-2026-prep/
- **Repository:** https://github.com/dvCodeWorld/rrb-ntpc-2026-prep

## Features
- **Previous Year Papers (PYQ) — 45,268 real questions (2016–2026):** every question appears once and shows each exam shift it was asked in (e.g. `CBT-1 · 11 Jan 2021 · Shift 2`). Year / stage / level / section / language mock builder, full CBT-1 & CBT-2 PYQ mocks with official section ratios, replay of original shift papers, **Most Repeated** questions (asked in 2+ exams), and full-text search in English & Hindi. Data in `public/pyq/` is loaded on demand ([`docs/PYQ_BANK.md`](docs/PYQ_BANK.md)).
- **Bilingual Exam Interface (`हिं + EN` / `हिंदी` / `EN`):** Switch languages anytime in the navbar or mid-exam without losing selected answers.
- **Official 2026 Syllabus Categorization:** General Awareness, Mathematics, General Intelligence & Reasoning, and Station Master CBAT across 45 official sub-categories.
- **Weighted Mock Generators:** CBT-1 (`40:30:30`, `-1/3` negative marking), CBT-2 (`50:35:35`, `-1/3` negative marking), Station Master CBAT Battery (`0` negative marking), and Custom Topic Drill Builder.
- **TCS iON–Style CBT Simulator:** Countdown timer, section switcher, 5-state Question Palette (`Not Visited`, `Not Answered`, `Answered`, `Marked`, `Answered & Marked`), and support for both **MCQ** and **Fill-in-the-Blank** questions.
- **Interactive CBAT Psycho Lab:** Timed Track/Station Memory recall, Selective Attention (Sum of Odd Numbers), and Spatial Shortest Route drills.
- **Local Persistence (`localStorage`):** Tracks seen question IDs (with unseen-first prioritization), bookmarks, test history, and custom imported JSON questions.
- **Client-Side PDF Scorecards:** Exports downloadable A4 scorecards and complete answer keys with explanations using `jspdf` and `jspdf-autotable` (Hindi text rendered correctly; PYQ rows include where the question was asked).
- **Mobile-first:** every screen, the exam simulator and the PYQ tab are designed for phone screens first.

## Quick Start
```powershell
npm install
npm run dev
```

## Build & Verification
```powershell
npm run build
npm run lint
```

## AI Agent Memory & Documentation
- [`AGENT.md`](AGENT.md) — Primary AI agent memory, invariants, and update protocol.
- [`docs/EXAM_SPEC_2026.md`](docs/EXAM_SPEC_2026.md) — Web-verified 2026 RRB NTPC & Station Master exam specifications, dates, CBAT T-score 42 rules, normalization formula, and A-2 medical standards.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Application architecture, state contracts, scoring logic, and PDF pipeline.
- [`docs/DATA_MAINTENANCE.md`](docs/DATA_MAINTENANCE.md) — Step-by-step instructions to update exam data and expand `src/data/questions.json`.
- [`docs/PYQ_BANK.md`](docs/PYQ_BANK.md) — Previous-Year-Question bank: formats, build pipeline, verification.
