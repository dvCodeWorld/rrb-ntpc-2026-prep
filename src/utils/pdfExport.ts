import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TestAttempt } from '../types/exam';
import { formatDuration } from './scoring';

export function exportAttemptToPdf(attempt: TestAttempt, candidateName: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 34, 'F');

  doc.setFillColor(79, 70, 229); // indigo-600 accent strip
  doc.rect(0, 34, pageWidth, 2.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('RRB NTPC & STATION MASTER 2026', 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text('Official Pattern Mock Scorecard & Verified Answer Key', 14, 21);

  const formattedDate = new Date(attempt.completedAt).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  doc.setFontSize(9);
  doc.text(`Generated: ${formattedDate}`, pageWidth - 14, 14, { align: 'right' });
  doc.text(`Candidate: ${candidateName || 'RRB Aspirant'}`, pageWidth - 14, 21, {
    align: 'right',
  });

  // Test Title & Summary Box
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(attempt.title, 14, 46);

  // KPI summary grid
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 51, pageWidth - 28, 28, 2, 2, 'FD');

  const colW = (pageWidth - 28) / 4;
  const kpis = [
    {
      label: 'NET SCORE',
      value: `${attempt.netScore} / ${attempt.maxScore}`,
      sub: `${attempt.percentage}% Overall`,
    },
    {
      label: 'ACCURACY',
      value: `${attempt.accuracy}%`,
      sub: `${attempt.correct} Correct • ${attempt.wrong} Wrong`,
    },
    {
      label: 'NEGATIVE PENALTY',
      value: `-${attempt.negativeMarksDeducted}`,
      sub:
        attempt.negativeMarkingRate > 0
          ? `Rate: -${attempt.negativeMarkingRate.toFixed(2)} / wrong`
          : 'No negative marking',
    },
    {
      label: 'TIME & ATTEMPT',
      value: formatDuration(attempt.timeTakenSeconds),
      sub: `${attempt.attempted}/${attempt.totalQuestions} Attempted`,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * colW + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x, 58);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, x, 66);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.sub, x, 73);
  });

  // Section-Wise Performance Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Section-Wise Performance Breakdown', 14, 89);

  autoTable(doc, {
    startY: 92,
    head: [['Category', 'Questions', 'Attempted', 'Correct', 'Wrong', 'Marks', 'Accuracy']],
    body: attempt.categoryBreakdown.map((sec) => [
      sec.category,
      String(sec.total),
      String(sec.attempted),
      String(sec.correct),
      String(sec.wrong),
      `${sec.marks} / ${sec.maxMarks}`,
      `${sec.accuracy}%`,
    ]),
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  });

  // Detailed Answer Key & Explanations Table
  const lastTableY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 130;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Complete Answer Key & Explanations', 14, lastTableY + 11);

  autoTable(doc, {
    startY: lastTableY + 14,
    head: [['#', 'ID & Topic', 'Question', 'Your Ans', 'Correct Ans', 'Status']],
    body: attempt.details.map((d, idx) => {
      const statusText = !d.isAttempted ? 'Skipped' : d.isCorrect ? 'Correct' : 'Wrong';
      const cleanQuestion = `${d.question}\n\nExplanation: ${d.explanation}`;
      return [
        String(idx + 1),
        `${d.questionId}\n${d.subCategory}`,
        cleanQuestion,
        d.isAttempted ? d.userAnswer : '—',
        d.correctAnswer,
        statusText,
      ];
    }),
    styles: {
      fontSize: 7.8,
      cellPadding: 2.5,
      valign: 'top',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 78 },
      3: { cellWidth: 24 },
      4: { cellWidth: 26 },
      5: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 5) {
        const val = String(hookData.cell.raw);
        if (val === 'Correct') {
          hookData.cell.styles.textColor = [5, 150, 105];
        } else if (val === 'Wrong') {
          hookData.cell.styles.textColor = [220, 38, 38];
        } else {
          hookData.cell.styles.textColor = [100, 116, 139];
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Page footer numbering
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `RRB NTPC & Station Master 2026 Prep Suite • Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    );
  }

  const safeSlug = attempt.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  doc.save(`rrb-2026-${safeSlug || 'scorecard'}.pdf`);
}
