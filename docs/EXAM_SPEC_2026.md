# RRB NTPC & Station Master 2026 — Verified Exam Specification

> **Last Web-Verified:** `2026-11-25`  
> **Scope:** Official exam patterns, 2026 CEN notifications, CBAT/RDSO psycho-test scoring rules, normalization, medical standards, and factual audit of the local `questions.json` bank.

---

## 1. Official 2026 Notification Tracks

Starting in 2026, RRB split Station Master recruitment into a standalone notification alongside the general NTPC Graduate notification. Both tracks are documented here so the app and AI agents stay accurate across cycles.

### Track A: RRB NTPC Graduate (CEN 06/2026) & Classic NTPC Stages
- **Vacancies:** **3,548** Graduate-level vacancies (CEN 06/2026).
- **Tentative Schedule:** CBT-1 tentatively planned to begin in the **4th week of December 2026**.
- **Notable 2026 Rule Change:** Under CEN 06/2026, the **Computer-Based Typing Skill Test (CBTST)** for typist-related graduate posts (*Senior Clerk cum Typist*, *Junior Accounts Assistant cum Typist*) was **dispensed with**; basic computer/typing proficiency is assessed post-joining.
- **Selection Stages:** `CBT-1 (Screening)` -> `CBT-2 (Mains / Merit)` -> `Document Verification (DV)` -> `Medical Examination`.

#### CBT-1 Pattern (Screening)
| Parameter | Value |
| :--- | :--- |
| **Total Questions / Marks** | **100 Questions / 100 Marks** (1 mark per correct answer) |
| **Duration** | **90 Minutes** (**120 Minutes** for eligible PwBD candidates with scribe) |
| **Negative Marking** | **1/3rd mark** deducted per incorrect answer |
| **General Awareness** | **40 Questions** (40%) |
| **Mathematics** | **30 Questions** (30%) |
| **General Intelligence & Reasoning** | **30 Questions** (30%) |
| **Shortlisting to CBT-2** | **20x** community-wise vacancies |

#### CBT-2 Pattern (Mains)
| Parameter | Value |
| :--- | :--- |
| **Total Questions / Marks** | **120 Questions / 120 Marks** (1 mark per correct answer) |
| **Duration** | **90 Minutes** (**120 Minutes** for eligible PwBD candidates with scribe) |
| **Negative Marking** | **1/3rd mark** deducted per incorrect answer |
| **General Awareness** | **50 Questions** (app displays `50% in CBT-2` weight label; ratio `50/120`) |
| **Mathematics** | **35 Questions** (app displays `35% in CBT-2` weight label; ratio `35/120`) |
| **General Intelligence & Reasoning** | **35 Questions** (app displays `35% in CBT-2` weight label; ratio `35/120`) |

#### Minimum Qualifying Marks (CBT Stages)
- **UR & EWS:** `40%`
- **OBC (NCL):** `30%`
- **SC:** `30%`
- **ST:** `25%`
- *(PwBD candidates may receive a `2%` relaxation if there is a shortage against reserved vacancies. Actual shortlisting cut-offs are governed by merit & normalization.)*

---

### Track B: Standalone RRB Station Master (CEN 08/2026)
- **Post & Pay:** Station Master, **Pay Level 6** (7th CPC, starting basic pay **₹35,400/month** + allowances).
- **Vacancies:** **1,265** vacancies across RRBs/Railway Zones.
- **Eligibility:** Bachelor's Degree in any discipline from a recognized university; Age **20–33 years** (general/UR), with standard upper-age relaxations (+3 yrs OBC-NCL, +5 yrs SC/ST, plus Ex-SM/PwBD per Govt norms).
- **Important Dates (CEN 08/2026):**
  - Notification Released: **26 Oct 2026**
  - Online Applications: **27 Oct 2026 – 25 Nov 2026 (11:59 PM)**
  - Fee Payment Deadline: **27 Nov 2026**
  - Application Correction Window: **28 Nov 2026 – 7 Dec 2026**
- **Selection Process:** `Single-Stage CBT` -> `CBAT (Psycho Test, 8x shortlisting in standard SM cycles)` -> `Document Verification` -> `A-2 Medical Exam`.

#### CEN 08/2026 Single-Stage CBT Pattern (Revised Track)
| Section / Subject | Questions / Marks | Notes |
| :--- | :---: | :--- |
| **Basic Science & Mathematics** | **30** | Arithmetic, Algebra, Geometry, Trig, Stats, Units, Measurements, Mass/Weight/Density, Work/Power/Energy, Heat, Electricity |
| **Data Analysis & Interpretation** | **30** | Multi-source DI, Tables, Graphs, Scatter Plots, Pie Charts, Venn Diagrams, Data Sufficiency, Data Arrangement |
| **Logical Capability (incl. English RC)** | **20** | Binary Logic, Syllogism, Clocks, Calendars, Blood Relations, Puzzles + **English Reading Comprehension** (new) |
| **Mental Reasoning** | **20** | Analogies, Series, Coding-Decoding, Ranking, Arrangement |
| **Total** | **100 Qs / 100 Marks** | **Duration: 120 Minutes** • **Negative Marking: 1/3rd** • *No separate GA/CA section in CEN 08/2026 CBT* |

*(Note: Classic RRB NTPC Station Master cycles used CBT-1 + CBT-2 with General Awareness. Our app supports both traditional NTPC CBT-1/CBT-2 + CBAT workflows and can add a dedicated CEN 08/2026 preset if requested.)*

---

## 2. Station Master CBAT (RDSO Psycho Test) Rules

Administered by **RDSO** (Research Designs and Standards Organisation, Lucknow) for safety-critical operational posts (Station Master & Traffic Assistant).

1. **5 Test Batteries Generating 6 Scores:**
   - **Intelligence Test:** Odd-figure / pattern classification (typically 5 figures, pick the odd 1).
   - **Selective Attention Test:** Speed vigilance under tight timers (e.g., sum of odd numbers in a row, digit/symbol matching).
   - **Spatial Scanning Test:** Shortest valid route between nodes on a yard/street map while avoiding blocked segments/barriers.
   - **Information Ordering Test:** Rule-based sequential ordering/transformation of shapes, codes, or operational steps.
   - **Personality / Situational Judgment Test:** Evaluates safety mindset, emotional stability, and operational judgment; generates **2 distinct trait scores** (resulting in 6 scores across 5 batteries).
   - *(Note: Track/Station Memory recall is also included in this app's syllabus & CBAT Lab per user specification.)*
2. **No Negative Marking:** `0` marks deducted for wrong answers in CBAT.
3. **Minimum T-Score 42 Rule (Strict Elimination):**
   - Candidates must score a **minimum T-score of 42 in EVERY individual test battery** (and both Personality trait dimensions).
   - **No category relaxation** (UR, EWS, OBC, SC, ST, PwBD must all score `>= 42` in each battery).
   - **Standardization Formula:**
     $$T = 50 + 10 \times \left(\frac{x - \mu}{\sigma}\right)$$
     where $x$ = candidate raw score, $\mu$ = batch mean, $\sigma$ = batch standard deviation.
4. **Final Merit Weightage (Station Master):**
   - **70%** from CBT normalized marks (CBT-2 in classic NTPC; Single-Stage CBT in CEN 08/2026)
   - **30%** from Composite CBAT score

---

## 3. Multi-Shift Equated Percentile Normalization Formula

Used by RRB across multi-shift CBT-1 and CBT-2 examinations:

$$\widehat{M}_{ij} = \left(\frac{\bar{M}_{t}^{g} - M_{q}^{g}}{\bar{M}_{ti} - M_{iq}}\right) \times (M_{ij} - M_{iq}) + M_{q}^{gm}$$

Where:
- $\widehat{M}_{ij}$: Normalized score of candidate $j$ in shift $i$
- $\bar{M}_{t}^{g}$: Average marks of top $0.1\%$ candidates across all shifts
- $M_{q}^{g}$: Mean + Standard Deviation of all candidates across all shifts
- $\bar{M}_{ti}$: Average marks of top $0.1\%$ candidates in shift $i$
- $M_{iq}$: Mean + Standard Deviation in shift $i$
- $M_{ij}$: Raw score of candidate $j$ in shift $i$

---

## 4. Station Master Medical Standard: A-2 (Strict)

- **Distant Vision:** `6/9`, `6/9` **without glasses** (no correction permitted).
- **Near Vision:** `Sn 0.6`, `0.6` **without glasses**.
- **Required Visual Checks:** Colour Vision (Ishihara plates), Binocular Vision, Night Vision, Mesopic Vision.
- **Disqualifications:** Spectacles/contact lenses, **LASIK**, PRK, LASEK, or any refractive correction surgery strictly disqualifies candidates for A-2 posts.

---

## 5. Question Bank Audit Summary (`src/data/questions.json`)

Audited on `2026-11-25` (`86` total questions: `69` `mcq`, `17` `fill_in_blank`):

| Category | Count | Sample Verified Facts |
| :--- | :---: | :--- |
| **General Awareness** | 30 | Kavach 4.0 (RDSO SIL-4 ATP preventing SPAD/collisions), IBCA HQ in New Delhi, Vande Bharat Sleeper, Article 17, 61st Amendment (1988), CSMT UNESCO (2004), Chandrayaan-3 Pragyan rover, Aditya-L1 at L1, Tarapur (1969), First Indian train Bori Bunder–Thane (1853), GST (1 July 2017), Sattriya (Assam), Konark (Eastern Ganga) |
| **Mathematics** | 25 | Verified arithmetic, BODMAS (`48 ÷ 6 × 3 + 12 - 4 = 32`), recurring decimal (`0.3636... = 4/11`), HCF×LCM, mensuration (`1540 cm³`), relative speed, CI, algebra (`x+1/x=5 => 23`), trig (`sin θ=3/5 => tan θ=3/4`), empirical mode (`3·25 - 2·28 = 19`), DI central angle (`144°`) |
| **General Intelligence & Reasoning** | 20 | Series (`3,7,15,31,63 -> 127`), operator substitution (`32`), square diagonals (`8` triangles), Venn (`50 - (30+25-10) = 5`), seating (`Q`), direction (`√(6²+8²)=10`, `North-East`), ranking (`40-13+1=28`), coding (`TRACK=53`) |
| **Station Master Special — CBAT** | 11 | Track/Station memory (`UDAIPUR = Platform 6`), Signal aspect (`Double Yellow`), Odd-sum (`30`, `40`), Odd pattern (`C) [●9●8]`), Shortest route (`8 km`), Dispatch order (`3->1->2->4`), Code transform (`264 -> 674`), Safety SJT |

---

## 6. Specification Changelog
- **2026-11-25:** Initial creation after live web verification of RRB NTPC (CEN 06/2026), Standalone Station Master (CEN 08/2026), RDSO CBAT 5-battery/6-score T-score 42 rules, Equated Percentile Normalization, A-2 medical criteria, and Railway current affairs (`Kavach 4.0`, `IBCA`, `Vande Bharat Sleeper`).
