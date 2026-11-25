import type { ExamCategory } from '../types/exam';

export interface SyllabusCategoryMeta {
  category: ExamCategory;
  shortName: string;
  cbt1WeightLabel: string;
  cbt2WeightLabel: string;
  cbt1Questions: number;
  cbt2Questions: number;
  cbt1SharePercent: number;
  cbt2SharePercent: number;
  color: string;
  badgeClass: string;
  accentHex: string;
  description: string;
  subCategories: string[];
}

export const SYLLABUS: SyllabusCategoryMeta[] = [
  {
    category: 'General Awareness',
    shortName: 'General Awareness',
    cbt1WeightLabel: '40% weightage in CBT-1',
    cbt2WeightLabel: '50% weightage in CBT-2',
    cbt1Questions: 40,
    cbt2Questions: 50,
    cbt1SharePercent: 40,
    cbt2SharePercent: 42,
    color: 'indigo',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    accentHex: '#4f46e5',
    description:
      'Current Affairs, CBSE-level Science, History, Geography, Polity, Economy, Static GK, Space & Nuclear Tech, Computers & Environment.',
    subCategories: [
      'Current Affairs (National & International)',
      'General Science (Physics, Chemistry, Biology - up to 10th CBSE)',
      'Indian History & Freedom Struggle',
      'Indian & World Geography',
      'Indian Polity & Governance',
      'Indian Economy',
      'Static GK (Art & Culture, Awards, Sports, Books, Monuments)',
      'Science & Technology (Space & Nuclear)',
      'Basics of Computers & Environment',
    ],
  },
  {
    category: 'Mathematics',
    shortName: 'Mathematics',
    cbt1WeightLabel: '30% weightage in CBT-1',
    cbt2WeightLabel: '35% weightage in CBT-2',
    cbt1Questions: 30,
    cbt2Questions: 35,
    cbt1SharePercent: 30,
    cbt2SharePercent: 29,
    color: 'emerald',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    accentHex: '#059669',
    description:
      'Arithmetic, Number Systems, Mensuration, Elementary Algebra, Geometry, Trigonometry, Statistics & Data Interpretation.',
    subCategories: [
      'Number System',
      'Simplification & BODMAS',
      'Decimals & Fractions',
      'LCM & HCF',
      'Ratio & Proportion',
      'Percentage',
      'Mensuration (2D & 3D)',
      'Time & Work',
      'Time, Speed & Distance',
      'Simple & Compound Interest',
      'Profit & Loss',
      'Elementary Algebra',
      'Geometry & Trigonometry',
      'Elementary Statistics',
      'Data Interpretation',
    ],
  },
  {
    category: 'General Intelligence & Reasoning',
    shortName: 'Reasoning',
    cbt1WeightLabel: '30% weightage in CBT-1',
    cbt2WeightLabel: '35% weightage in CBT-2',
    cbt1Questions: 30,
    cbt2Questions: 35,
    cbt1SharePercent: 30,
    cbt2SharePercent: 29,
    color: 'amber',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    accentHex: '#d97706',
    description:
      'Verbal & Non-Verbal Reasoning, Series, Coding-Decoding, Syllogisms, Puzzles, Data Sufficiency & Decision Making.',
    subCategories: [
      'Analogies',
      'Number & Alphabet Series',
      'Coding-Decoding',
      'Mathematical Operations',
      'Similarities & Differences',
      'Blood Relations',
      'Analytical Reasoning',
      'Syllogism',
      'Jumbling',
      'Venn Diagrams',
      'Puzzles',
      'Data Sufficiency',
      'Statement-Conclusion & Courses of Action',
      'Decision Making',
      'Direction & Distance',
      'Ranking',
    ],
  },
  {
    category: 'Station Master Special — CBAT',
    shortName: 'CBAT Psycho',
    cbt1WeightLabel: 'Stage-3 (Station Master)',
    cbt2WeightLabel: '30% Final Merit Weight',
    cbt1Questions: 0,
    cbt2Questions: 0,
    cbt1SharePercent: 0,
    cbt2SharePercent: 0,
    color: 'rose',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    accentHex: '#e11d48',
    description:
      'Computer-Based Aptitude Test for Station Master (Level-6): Memory, Selective Attention, Spatial Scanning, Information Ordering & Situational Judgment.',
    subCategories: [
      'Memory Test (Track/Station Memory)',
      'Selective Attention (Odd Figure / Sum of Odd Numbers)',
      'Spatial Scanning (Shortest Route Finder)',
      'Information Ordering',
      'Personality/Situational Judgment',
    ],
  },
];

export const EXAM_PATTERNS = [
  {
    id: 'cbt1',
    name: 'RRB NTPC CBT-1 (Screening)',
    totalQuestions: 100,
    durationMinutes: 90,
    negativeMarking: '1/3 mark deducted per wrong answer',
    sections: [
      { name: 'General Awareness', questions: 40, weightage: '40%' },
      { name: 'Mathematics', questions: 30, weightage: '30%' },
      { name: 'General Intelligence & Reasoning', questions: 30, weightage: '30%' },
    ],
  },
  {
    id: 'cbt2',
    name: 'RRB NTPC CBT-2 (Mains)',
    totalQuestions: 120,
    durationMinutes: 90,
    negativeMarking: '1/3 mark deducted per wrong answer',
    sections: [
      { name: 'General Awareness', questions: 50, weightage: '50% weightage (50 Qs)' },
      { name: 'Mathematics', questions: 35, weightage: '35% weightage (35 Qs)' },
      { name: 'General Intelligence & Reasoning', questions: 35, weightage: '35% weightage (35 Qs)' },
    ],
  },
  {
    id: 'cbat',
    name: 'Station Master — CBAT (Psycho Test)',
    totalQuestions: 5,
    durationMinutes: 45,
    negativeMarking: 'No negative marking • Minimum T-Score 42 in each battery',
    sections: [
      { name: 'Memory Test (Track/Station)', questions: 1, weightage: 'Battery 1' },
      { name: 'Selective Attention (Odd / Sum)', questions: 1, weightage: 'Battery 2' },
      { name: 'Spatial Scanning (Shortest Route)', questions: 1, weightage: 'Battery 3' },
      { name: 'Information Ordering', questions: 1, weightage: 'Battery 4' },
      { name: 'Personality / Situational Judgment', questions: 1, weightage: 'Battery 5' },
    ],
  },
];

export function matchesSubCategory(questionSubCategory: string, syllabusSubCategory: string): boolean {
  const q = questionSubCategory.toLowerCase().trim();
  const s = syllabusSubCategory.toLowerCase().trim();
  if (q === s) return true;
  if (s.startsWith(q) || q.startsWith(s)) return true;
  // Handle slight punctuation variations like "Indian Polity" -> "Indian Polity & Governance"
  const qWords = q.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const sClean = s.replace(/[^a-z0-9\s]/g, ' ');
  return qWords.length >= 2 && qWords.every((w) => sClean.includes(w));
}
