# Data & Exam Update Playbook (`docs/DATA_MAINTENANCE.md`)

Use this guide whenever:
- RRB publishes a new CEN notification, exam date, vacancy update, or pattern change.
- You want to add, edit, or audit questions in [`src/data/questions.json`](../src/data/questions.json).
- You want to add a new preset exam track (such as **CEN 08/2026 Standalone Station Master**) to the simulator.

---

## 1. Updating Official Exam Info (When New Notifications Arrive)

1. **Verify with live web search** (official RRB portals such as `rrb.indianrailways.gov.in` or multiple reputable exam summaries):
   - Check CEN number, post name, Pay Level, vacancy count, application/exam dates.
   - Check stage count (CBT-1 + CBT-2 vs Single-Stage CBT), section counts, duration, negative marking, qualifying %, and CBAT T-score rules.
2. **Update [`docs/EXAM_SPEC_2026.md`](EXAM_SPEC_2026.md)** first:
   - Update the `Last Web-Verified` date at the top.
   - Edit the relevant track section and append an entry to `Specification Changelog`.
3. **Update [`AGENT.md`](../AGENT.md)**:
   - Sync Section 4 (`Verified Domain Snapshot`) and question count baselines.
4. **Update Code (only if app behavior or UI labels must change)**:
   - Update `EXAM_PATTERNS` or `SYLLABUS` in [`src/data/syllabus.ts`](../src/data/syllabus.ts).
   - If adding a new preset mock test mode:
     1. Add the mode union value in [`src/types/exam.ts`](../src/types/exam.ts) (`TestMode`).
     2. Add ratio/duration logic in [`src/utils/scoring.ts`](../src/utils/scoring.ts) (`buildPresetMockTest`).
     3. Expose the launcher card/button in [`src/components/MockBuilderView.tsx`](../src/components/MockBuilderView.tsx) and [`src/App.tsx`](../src/App.tsx).

---

## 2. Expanding `src/data/questions.json`

### Required JSON Schema
Every entry in [`src/data/questions.json`](../src/data/questions.json) MUST conform to this exact shape (enforced by [`validateQuestionsPayload`](../src/utils/storage.ts)):

```json
{
  "id": "RRB_GA_031",
  "type": "mcq",
  "category": "General Awareness",
  "subCategory": "Current Affairs (National & International)",
  "examTag": ["CBT-1", "CBT-2", "Station Master"],
  "question": "Question stem goes here?",
  "questionHi": "यहाँ हिंदी प्रश्न लिखें?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "optionsHi": ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D"],
  "correctAnswer": "Option A",
  "correctAnswerHi": "विकल्प A",
  "explanation": "Concise, accurate explanation.",
  "explanationHi": "संक्षिप्त और सटीक हिंदी व्याख्या।"
}
```

### Strict Rules for Questions
1. **Unique `id` convention:**
   - `RRB_GA_###` for `General Awareness`
   - `RRB_MATH_###` for `Mathematics`
   - `RRB_REAS_###` for `General Intelligence & Reasoning`
   - `RRB_CBAT_###` for `Station Master Special — CBAT`
2. **Exact `category` strings (only these 4 are valid):**
   - `"General Awareness"`
   - `"Mathematics"`
   - `"General Intelligence & Reasoning"`
   - `"Station Master Special — CBAT"`
3. **`subCategory` alignment:**
   - Prefer the exact sub-category strings defined in `SYLLABUS` inside [`src/data/syllabus.ts`](../src/data/syllabus.ts) so filters and coverage counts stay 100% consistent.
4. **`type` rules:**
   - `"mcq"`: `options` must contain at least 2 strings (4 preferred), and `correctAnswer` MUST match one element of `options` character-for-character.
   - `"fill_in_blank"`: `options` MUST be `[]`, and `correctAnswer` should be a clean single number or short keyword/phrase (avoid ambiguous punctuation).
5. **`examTag` values:** Only `"CBT-1"`, `"CBT-2"`, `"Station Master"`.
6. **Fact & Math Verification:** Independently compute every Math/Reasoning/CBAT answer and verify every GA/Current Affairs fact before adding.

---

## 3. Pre-Finish Verification Checklist

Run in PowerShell from the project root after **every** edit:

```powershell
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node -e "const qs = require('./src/data/questions.json'); const ids = new Set(qs.map(q=>q.id)); const badMcq = qs.filter(q=>q.type==='mcq' && !q.options.includes(q.correctAnswer)); const badBlank = qs.filter(q=>q.type==='fill_in_blank' && q.options.length !== 0); const badCat = qs.filter(q=>!['General Awareness','Mathematics','General Intelligence & Reasoning','Station Master Special — CBAT'].includes(q.category)); console.log({total: qs.length, uniqueIds: ids.size, badMcq: badMcq.map(q=>q.id), badBlank: badBlank.map(q=>q.id), badCat: badCat.map(q=>q.id)});"
```

All error arrays (`badMcq`, `badBlank`, `badCat`) must be `[]`, `uniqueIds` must equal `total`, `npm run build` must exit `0`, and `npm run lint` must report `0 warnings and 0 errors`.
