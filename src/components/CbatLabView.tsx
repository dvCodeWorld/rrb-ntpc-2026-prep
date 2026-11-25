import React, { useEffect, useState } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  Compass,
  Eye,
  Hash,
  Play,
  RefreshCw,
  Timer,
  XCircle,
} from 'lucide-react';

interface CbatLabViewProps {
  onStartCbatMock: () => void;
}

interface MemoryPair {
  station: string;
  platform: string;
}

const STATION_POOL = [
  'KOTA JN',
  'AJMER JN',
  'JAIPUR',
  'UDAIPUR',
  'BIKANER',
  'JODHPUR',
  'ALWAR',
  'RATLAM',
  'UJJAIN',
  'ITARSI',
];

function generateMemorySet(): MemoryPair[] {
  const shuffled = [...STATION_POOL].sort(() => Math.random() - 0.5).slice(0, 5);
  const platforms = ['PF-1', 'PF-2', 'PF-3', 'PF-4', 'PF-5', 'PF-6', 'PF-7']
    .sort(() => Math.random() - 0.5)
    .slice(0, 5);
  return shuffled.map((station, i) => ({ station, platform: platforms[i] }));
}

function generateOddSumRow(): { nums: number[]; expected: number } {
  const nums: number[] = [];
  let expected = 0;
  for (let i = 0; i < 9; i++) {
    const val = Math.floor(Math.random() * 24) + 1;
    nums.push(val);
    if (val % 2 === 1) expected += val;
  }
  if (expected === 0) {
    nums[0] = 7;
    expected = 7;
  }
  return { nums, expected };
}

export const CbatLabView: React.FC<CbatLabViewProps> = ({ onStartCbatMock }) => {
  const [activeDrill, setActiveDrill] = useState<'memory' | 'oddsum' | 'spatial'>(
    'memory',
  );

  // Drill 1: Track/Station Memory
  const [memoryPhase, setMemoryPhase] = useState<'idle' | 'memorize' | 'recall'>('idle');
  const [memoryPairs, setMemoryPairs] = useState<MemoryPair[]>([]);
  const [memorySeconds, setMemorySeconds] = useState(12);
  const [targetIdx, setTargetIdx] = useState(0);
  const [memoryChoice, setMemoryChoice] = useState<string | null>(null);

  useEffect(() => {
    if (memoryPhase !== 'memorize') return;
    const id = window.setTimeout(() => {
      setMemorySeconds((s) => {
        if (s <= 1) {
          setMemoryPhase('recall');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearTimeout(id);
  }, [memoryPhase, memorySeconds]);

  const startMemoryDrill = () => {
    const pairs = generateMemorySet();
    setMemoryPairs(pairs);
    setTargetIdx(Math.floor(Math.random() * pairs.length));
    setMemoryChoice(null);
    setMemorySeconds(12);
    setMemoryPhase('memorize');
  };

  // Drill 2: Selective Attention (Sum of Odd Numbers)
  const [oddRow, setOddRow] = useState(() => generateOddSumRow());
  const [oddInput, setOddInput] = useState('');
  const [oddStatus, setOddStatus] = useState<'none' | 'correct' | 'wrong'>('none');
  const [oddStreak, setOddStreak] = useState(0);

  const checkOddSum = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oddInput.trim()) return;
    if (Number(oddInput.trim()) === oddRow.expected) {
      setOddStatus('correct');
      setOddStreak((s) => s + 1);
    } else {
      setOddStatus('wrong');
      setOddStreak(0);
    }
  };

  const nextOddRow = () => {
    setOddRow(generateOddSumRow());
    setOddInput('');
    setOddStatus('none');
  };

  // Drill 3: Spatial Scanning
  const [spatialChoice, setSpatialChoice] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 p-6 text-white shadow-md sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200 ring-1 ring-rose-400/30">
            <BrainCircuit className="h-3.5 w-3.5" />
            Station Master (Level-6) Psycho Test Simulator
          </div>
          <h1 className="text-xl font-extrabold sm:text-2xl">
            CBAT Interactive Drills & Aptitude Battery
          </h1>
          <p className="text-xs text-slate-300 sm:text-sm">
            Train speed & precision across RDSO CBAT batteries (minimum T-score 42 in each
            battery; 30% weight in Station Master final merit).
          </p>
        </div>

        <button
          type="button"
          onClick={onStartCbatMock}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-rose-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-rose-400"
        >
          <Play className="h-4 w-4 fill-current" />
          Launch Full CBAT Question Battery
        </button>
      </div>

      {/* Drill Selector */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveDrill('memory')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeDrill === 'memory'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Eye className="h-4 w-4" />
          1. Track / Station Memory
        </button>
        <button
          type="button"
          onClick={() => setActiveDrill('oddsum')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeDrill === 'oddsum'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Hash className="h-4 w-4" />
          2. Sum of Odd Numbers
        </button>
        <button
          type="button"
          onClick={() => setActiveDrill('spatial')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeDrill === 'spatial'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Compass className="h-4 w-4" />
          3. Spatial Shortest Route
        </button>
      </div>

      {/* Active Drill Card */}
      {activeDrill === 'memory' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Track & Station Memory Timed Drill
              </h2>
              <p className="text-xs text-slate-500">
                Study the 5 Station-Platform assignments for 12 seconds, then recall the
                requested station&apos;s platform.
              </p>
            </div>
            <button
              type="button"
              onClick={startMemoryDrill}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {memoryPhase === 'idle' ? 'Start Memory Round' : 'New Round'}
            </button>
          </div>

          {memoryPhase === 'idle' && (
            <div className="py-12 text-center text-sm text-slate-500">
              Click <strong>Start Memory Round</strong> to reveal 5 station-platform pairs
              for 12 seconds.
            </div>
          )}

          {memoryPhase === 'memorize' && (
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800">
                <span className="flex items-center gap-2">
                  <Timer className="h-4 w-4" /> Memorize all pairs carefully!
                </span>
                <span className="font-mono text-base">{memorySeconds}s</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-5">
                {memoryPairs.map((pair) => (
                  <div
                    key={pair.station}
                    className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-center"
                  >
                    <div className="text-xs font-bold text-indigo-900">
                      {pair.station}
                    </div>
                    <div className="mt-2 rounded-lg bg-white py-1.5 font-mono text-sm font-extrabold text-slate-900 shadow-2xs">
                      {pair.platform}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setMemoryPhase('recall')}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Ready early? Skip to recall question →
              </button>
            </div>
          )}

          {memoryPhase === 'recall' && memoryPairs[targetIdx] && (
            <div className="mt-5 space-y-4">
              <p className="text-base font-bold text-slate-900">
                Which platform was assigned to{' '}
                <span className="rounded bg-indigo-100 px-2 py-0.5 text-indigo-800">
                  {memoryPairs[targetIdx].station}
                </span>
                ?
              </p>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {memoryPairs.map((p) => {
                  const chosen = memoryChoice === p.platform;
                  const isRight = p.platform === memoryPairs[targetIdx].platform;
                  let style =
                    'border-slate-200 bg-white text-slate-800 hover:border-indigo-400';
                  if (memoryChoice !== null) {
                    if (isRight) {
                      style = 'border-emerald-500 bg-emerald-50 text-emerald-900';
                    } else if (chosen) {
                      style = 'border-rose-500 bg-rose-50 text-rose-800';
                    }
                  }
                  return (
                    <button
                      key={p.platform}
                      type="button"
                      disabled={memoryChoice !== null}
                      onClick={() => setMemoryChoice(p.platform)}
                      className={`rounded-xl border py-3 font-mono text-sm font-bold transition ${style}`}
                    >
                      {p.platform}
                    </button>
                  );
                })}
              </div>

              {memoryChoice !== null && (
                <div className="flex items-center gap-2 text-xs font-bold">
                  {memoryChoice === memoryPairs[targetIdx].platform ? (
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Spot on! Perfect recall.
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-rose-700">
                      <XCircle className="h-4 w-4" /> Correct platform was{' '}
                      {memoryPairs[targetIdx].platform}.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeDrill === 'oddsum' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Selective Attention — Sum of Odd Numbers
              </h2>
              <p className="text-xs text-slate-500">
                Scan the row quickly, ignore even numbers, and sum only the ODD numbers.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              Streak: {oddStreak}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            {oddRow.nums.map((n, idx) => (
              <div
                key={`${n}-${idx}`}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 font-mono text-base font-bold text-slate-900"
              >
                {n}
              </div>
            ))}
          </div>

          <form
            onSubmit={checkOddSum}
            className="mt-6 flex flex-wrap items-center justify-center gap-3"
          >
            <input
              type="number"
              value={oddInput}
              onChange={(e) => setOddInput(e.target.value)}
              placeholder="Sum of odd numbers"
              className="w-48 rounded-xl border border-slate-300 px-4 py-2.5 font-mono text-sm font-bold focus:border-indigo-600 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-600"
            >
              Verify Sum
            </button>
            <button
              type="button"
              onClick={nextOddRow}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Next Row →
            </button>
          </form>

          {oddStatus !== 'none' && (
            <div className="mt-4 text-center text-xs font-bold">
              {oddStatus === 'correct' ? (
                <span className="text-emerald-700">
                  Correct! Odd numbers:{' '}
                  {oddRow.nums.filter((n) => n % 2 === 1).join(' + ')} = {oddRow.expected}
                </span>
              ) : (
                <span className="text-rose-600">
                  Incorrect. Odd numbers are{' '}
                  {oddRow.nums.filter((n) => n % 2 === 1).join(' + ')} = {oddRow.expected}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {activeDrill === 'spatial' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">
              Spatial Scanning — Shortest Yard Route Finder
            </h2>
            <p className="text-xs text-slate-500">
              Find the shortest operational path from Junction <strong>S</strong> to
              Terminal <strong>T</strong> while avoiding the blocked track segment (X).
            </p>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:items-center">
            <div className="rounded-xl border border-slate-200 bg-slate-900 p-5 text-white">
              <svg viewBox="0 0 360 200" className="w-full">
                {/* Edges */}
                <line x1="40" y1="100" x2="140" y2="40" stroke="#64748b" strokeWidth="3" />
                <text x="80" y="58" fill="#cbd5e1" fontSize="12">4 km</text>

                <line x1="40" y1="100" x2="140" y2="160" stroke="#64748b" strokeWidth="3" />
                <text x="80" y="148" fill="#cbd5e1" fontSize="12">2 km</text>

                <line x1="140" y1="40" x2="140" y2="160" stroke="#38bdf8" strokeWidth="3" />
                <text x="148" y="105" fill="#7dd3fc" fontSize="12">1 km</text>

                {/* Blocked segment A->T */}
                <line
                  x1="140"
                  y1="40"
                  x2="310"
                  y2="100"
                  stroke="#ef4444"
                  strokeWidth="3"
                  strokeDasharray="6 4"
                />
                <text x="220" y="55" fill="#fca5a5" fontSize="11">3 km (BLOCKED X)</text>

                <line x1="140" y1="160" x2="230" y2="160" stroke="#64748b" strokeWidth="3" />
                <text x="175" y="152" fill="#cbd5e1" fontSize="12">4 km</text>

                <line x1="230" y1="160" x2="310" y2="100" stroke="#64748b" strokeWidth="3" />
                <text x="275" y="146" fill="#cbd5e1" fontSize="12">3 km</text>

                <line x1="140" y1="40" x2="230" y2="160" stroke="#64748b" strokeWidth="2.5" />
                <text x="195" y="105" fill="#cbd5e1" fontSize="12">3 km</text>

                {/* Nodes */}
                {[
                  { id: 'S', x: 40, y: 100, fill: '#4f46e5' },
                  { id: 'A', x: 140, y: 40, fill: '#0f172a' },
                  { id: 'B', x: 140, y: 160, fill: '#0f172a' },
                  { id: 'C', x: 230, y: 160, fill: '#0f172a' },
                  { id: 'T', x: 310, y: 100, fill: '#059669' },
                ].map((n) => (
                  <g key={n.id}>
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r="16"
                      fill={n.fill}
                      stroke="#e2e8f0"
                      strokeWidth="2"
                    />
                    <text
                      x={n.x}
                      y={n.y + 4}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="12"
                      fontWeight="bold"
                    >
                      {n.id}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-900">
                Select the shortest open route from S to T:
              </p>
              {[
                { label: 'S → B → C → T (9 km)', correct: true },
                { label: 'S → A → T (7 km)', correct: false },
                { label: 'S → A → C → T (10 km)', correct: false },
                { label: 'S → B → A → C → T (9 km via loop)', correct: false },
              ].map((opt) => {
                const selected = spatialChoice === opt.label;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setSpatialChoice(opt.label)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-xs font-semibold transition ${
                      selected
                        ? opt.correct
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                          : 'border-rose-500 bg-rose-50 text-rose-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {selected &&
                      (opt.correct ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-600" />
                      ))}
                  </button>
                );
              })}

              {spatialChoice && (
                <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <strong>Logic:</strong> S→A→T is blocked. S→B (2) + B→C (4) + C→T (3) =
                  <strong> 9 km</strong> (fewer hops &amp; shorter than S→A→C→T = 4+3+3 =
                  10 km, and S→B→A→C→T = 2+1+3+3 = 9 km with extra reversal).
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
