import React, { useState } from 'react';
import { History, Repeat, ScanText } from 'lucide-react';
import type { QuestionSource } from '../types/exam';

/** Images that belong to a question / option / passage (diagrams, formulas, scans). Tap to open full size. */
export const ImageList: React.FC<{
  srcs?: string[];
  alt: string;
  small?: boolean;
  /** false inside buttons (an <a> may not be nested in a <button>) */
  link?: boolean;
}> = ({ srcs, alt, small, link = true }) => {
  if (!srcs || srcs.length === 0) return null;
  const imgClass = `h-auto max-w-full rounded-lg border border-slate-200 bg-white ${
    small ? 'max-h-24' : 'max-h-[60vh]'
  }`;
  return (
    <span className="mt-2 flex flex-wrap gap-2">
      {srcs.map((src, i) =>
        link ? (
          <a
            key={src}
            href={src}
            target="_blank"
            rel="noreferrer"
            className="block max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={src} alt={`${alt} ${i + 1}`} loading="lazy" className={imgClass} />
          </a>
        ) : (
          <img key={src} src={src} alt={`${alt} ${i + 1}`} loading="lazy" className={imgClass} />
        ),
      )}
    </span>
  );
};

export const PassageBlock: React.FC<{ passage?: string; images?: string[] }> = ({
  passage,
  images,
}) => {
  if (!passage && (!images || images.length === 0)) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm leading-relaxed text-slate-800">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">
        Passage / Directions
      </div>
      {passage && <p className="whitespace-pre-line">{passage}</p>}
      <ImageList srcs={images} alt="Passage image" />
    </div>
  );
};

/** "Asked in" exam sittings + repeat badge for previous-year questions. */
export const AskedInChips: React.FC<{ source?: QuestionSource; initiallyOpen?: boolean }> = ({
  source,
  initiallyOpen = false,
}) => {
  const [open, setOpen] = useState(initiallyOpen);
  if (!source) return null;
  const shown = open ? source.askedIn : source.askedIn.slice(0, 2);
  const hidden = source.askedIn.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {source.repeatCount >= 2 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200">
          <Repeat className="h-3 w-3" />
          Asked {source.repeatCount}× in exams
        </span>
      )}
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
        <History className="h-3 w-3" />
        Asked in:
      </span>
      {shown.map((label) => (
        <span
          key={label}
          className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800 ring-1 ring-sky-200"
        >
          {label}
        </span>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
        >
          +{hidden} more
        </button>
      )}
    </div>
  );
};

export const SourceNotes: React.FC<{ source?: QuestionSource; hasImage?: boolean }> = ({
  source,
  hasImage,
}) => {
  if (!source || (!source.ocr && !source.note)) return null;
  return (
    <div className="mt-3 space-y-1">
      {source.ocr && (
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-500">
          <ScanText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {hasImage
            ? 'Text was read by OCR from the original paper — if a word looks wrong, check the image.'
            : 'Text was read by OCR from the original paper, so an occasional letter may be misread.'}
        </p>
      )}
      {source.note && (
        <p className="text-[11px] font-medium leading-snug text-amber-700">
          Note in source paper: {source.note}
        </p>
      )}
    </div>
  );
};
