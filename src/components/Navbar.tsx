import React, { useState } from 'react';
import {
  BookOpen,
  BrainCircuit,
  FileText,
  History,
  LayoutDashboard,
  Menu,
  PlayCircle,
  TrainFront,
  X,
} from 'lucide-react';
import type { ExamLanguage, ExamTag } from '../types/exam';

export type ActiveTab = 'dashboard' | 'pyq' | 'mock' | 'bank' | 'cbat' | 'history';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  targetExam: ExamTag;
  seenCount: number;
  totalCount: number;
  language: ExamLanguage;
  onChangeLanguage: (lang: ExamLanguage) => void;
}

const NAV_ITEMS: Array<{
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pyq', label: 'Previous Papers', icon: FileText },
  { id: 'mock', label: 'Mock & Practice', icon: PlayCircle },
  { id: 'bank', label: 'Syllabus & Bank', icon: BookOpen },
  { id: 'cbat', label: 'CBAT Psycho Lab', icon: BrainCircuit },
  { id: 'history', label: 'History & PDF', icon: History },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  targetExam,
  seenCount,
  totalCount,
  language,
  onChangeLanguage,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className="flex min-w-0 items-center gap-2 text-left focus:outline-none sm:gap-3"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200 sm:h-10 sm:w-10">
            <TrainFront className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-sm font-bold leading-tight tracking-tight text-slate-900 sm:text-lg">
                RRB NTPC & SM 2026
              </span>
              <span className="hidden whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200 2xl:inline-block">
                {targetExam}
              </span>
            </div>
            <p className="hidden whitespace-nowrap text-xs text-slate-500 sm:block xl:hidden 2xl:block">
              CBT-1 • CBT-2 • Station Master CBAT Prep
            </p>
          </div>
        </button>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-0.5 xl:flex">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Language Switcher, Progress Pill & Mobile Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px] font-bold">
            {(
              [
                { id: 'both', label: 'हिं + EN' },
                { id: 'hi', label: 'हिंदी' },
                { id: 'en', label: 'EN' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeLanguage(opt.id)}
                className={`whitespace-nowrap rounded-md px-2 py-1 transition ${
                  language === opt.id
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 2xl:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>
              Bank: <strong className="text-slate-900">{seenCount}</strong>/{totalCount} seen
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 xl:hidden"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 xl:hidden">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    setMobileOpen(false);
                  }}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
