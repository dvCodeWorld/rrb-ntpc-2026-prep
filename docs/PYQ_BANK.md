# Previous Year Question (PYQ) Bank (`docs/PYQ_BANK.md`)

> **Applies to:** `rrb-ntpc-2026-prep`
> **Last Verified:** `2026-11-26`
> **Data:** `public/pyq/` — 45,268 unique questions · 313 exam shifts (sittings) · 485 source papers · 2016–2026

The PYQ bank holds real RRB NTPC questions extracted from 626 previous-year PDF papers. Every
question is stored **once** and tagged with every exam shift it was asked in, so the app can offer
year-wise mocks, original-paper replays and "asked again and again" revision lists.

---

## 1. Files (`public/pyq/`, served as static files)

| Path | Loaded | Contents |
| :--- | :--- | :--- |
| `index.json` (~2.5 MB, ~0.75 MB gzipped) | When the **Previous Papers** tab opens | `sittings`, `papers` (original question order) and one compact row per question |
| `c/<year>_<ga\|math\|reas>_<n>.json` (51 chunks, ~18 MB total) | Only the chunks a test / page / search needs | Question bodies |
| `img/<paper>/<file>` (~33 MB) | Lazily, by `<img loading="lazy">` | Only images a question needs: diagrams, formula/fraction options, scan crops |
| `build_report.json` | Never (docs/checks) | Numbers from the last build |

### `index.json` shape (version 2)
```jsonc
{
  "version": 2,
  "cats": ["General Awareness", "Mathematics", "General Intelligence & Reasoning"],
  "chunks": ["2016_ga_1", "..."],
  "sittings": [{ "d": "2021-01-11", "y": 2021, "t": "3:00 PM - 4:30 PM", "sh": 2, "s": "CBT-1", "lv": "Graduate", "cen": "CEN 01/2019", "p": [12, 13] }],
  "papers":   [{ "f": "<source pdf>", "d": "...", "s": "CBT-1", "lv": "...", "sh": 2, "t": "...", "lg": "English", "si": 7, "q": ["PYQ_…", "…"] }],
  // [id, chunkIndex, categoryIndex, lang(0=en,1=hi), repeatCount, flags, paperIndexes]
  // flags: 1 = has images, 2 = text read by OCR, 4 = section inferred, 8 = has explanation
  "questions": [["PYQ_98cf81644e", 30, 2, 0, 6, 0, [101, 140, 266]]]
}
```

### Question body (chunk files)
```jsonc
{ "id": "PYQ_…", "c": 1, "l": "en", "q": "question text", "o": ["A", "B", "C", "D"], "a": 2,
  "e": "explanation (only when the source has one)", "p": "passage", "qi": ["img/…"], "oi": [[], ["img/…"], [], []],
  "pi": ["img/…"], "f": ["ocr", "sec-inferred"], "n": "note printed in the source paper" }
```
- `a` is the index of the correct option, as marked (green tick / answer key) in the source paper.
- An option that exists only as an image has the text `[Option N: see image]` and its image in `oi[N-1]`.

### IDs
`PYQ_<sha1(normalised question + sorted options)[:10]>` — stable across rebuilds, so bookmarks and the
seen-list survive a data refresh. If two papers print the same text but mark different answers, both are
kept and the second gets a `_xxxx` suffix (16 such questions in the current build).

---

## 2. How the bank is built

1. **Extraction** (`scripts/extraction/extract.py`, `glyph.py`, `merge.py`) reads the 626 PDFs:
   text layer where present, Windows OCR for question images and scanned pages, green tick / green
   text for the correct option, A–D glyph matching for scanned "1. C" answer rows. Hard-to-read
   questions are logged separately and are **not** included. Output: `questions.json` + `question_images/`.
2. **`scripts/build_pyq.py <folder with questions.json>`**:
   - Drops records without 4 distinct options or without an identified answer.
   - **Section**: from the paper's section label when present; otherwise a Naive Bayes text classifier
     trained on the labelled questions (held-out accuracy **98.5%**) plus keyword rules for unmistakable
     reasoning patterns (series, coding-decoding, Venn, syllogism, seating …).
   - **Duplicates**: exact match on normalised text + options, plus near-duplicates (≥ 80% character
     5-gram overlap with the same answer). One body is kept (clean text preferred over OCR).
   - **Sittings**: an exam shift is identified by *date + start time*, so the same shift saved under two
     file names (or in English and Hindi) is not counted as a repeat. `repeatCount` = distinct shifts.
   - Copies only the images a question needs; scan crops are re-encoded as JPEG.
3. **`node scripts/check_pyq.mjs`** — integrity gate (see below).

Current numbers: 415 questions asked in 2+ different exam shifts, 29 in 3+ (max 6).

---

## 3. App integration

- [`src/utils/pyq.ts`](../src/utils/pyq.ts) — loading (`loadPyqIndex`, `loadPyqQuestions` with per-chunk
  caching), labels (`sittingLabel`), filtering (`filterPyq`), mock selection (`pickPyqIds` with official
  CBT-1 40:30:30 / CBT-2 50:35:35 ratios and unseen-first ordering) and `buildPyqTestConfig`
  (54 s/question for CBT-1, 45 s for CBT-2, −1/3 negative marking for timed tests).
- [`src/components/PyqView.tsx`](../src/components/PyqView.tsx) — the **Previous Papers** tab:
  *Mock Tests* (quick starts + builder: year, stage, level, section, language, asked-2+/3+ times,
  OCR filter, count, timed/practice), *Original Papers* (replay a shift in its original order),
  *Most Repeated*, *Browse & Search* (search loads only the chunks of the filtered pool).
- PYQ questions are converted to the normal `Question` type (with optional `images`, `optionImages`,
  `passage`, `source`) and run through the existing `ExamSimulator`, `TestResultView` and PDF export.
  `App.tsx` keeps loaded PYQs in `pyqQuestions` (session only); the curated `questions.json` bank is
  unchanged.
- `QuestionAttemptDetail.askedIn` stores the exam shifts with each attempt, so history and PDFs show
  them after a reload.

---

## 4. Verification

```powershell
node scripts/check_pyq.mjs
```
Expected (2026-11-26): `{ questions: 45268, bodies: 45268, uniqueIds: 45268, papers: 485, sittings: 313, chunks: 51, imageRefs: 8685, askedTwicePlus: 415, problems: 0 }`.
