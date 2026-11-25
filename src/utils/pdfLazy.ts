import type { TestAttempt } from '../types/exam';

/** Load the PDF engine (jspdf + autotable, ~500 kB) only when a scorecard is actually downloaded. */
export function downloadAttemptPdf(attempt: TestAttempt, candidateName: string): Promise<void> {
  return import('./pdfExport').then((m) => m.exportAttemptToPdf(attempt, candidateName));
}
