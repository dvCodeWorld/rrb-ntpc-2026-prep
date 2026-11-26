"""Tesseract OCR (Hindi + English) for Hindi-medium papers, whose question text is printed as Devanagari images.

Windows OCR has no Hindi recogniser, so these images go to Tesseract. Configure with environment variables:
  TESSERACT_EXE  path to tesseract.exe   (default: C:/Program Files/Tesseract-OCR/tesseract.exe)
  TESSDATA_DIR   folder with hin.traineddata + eng.traineddata (default: ./tessdata next to this file)
"""
import os
import re
import subprocess
import tempfile
import unicodedata

import pymupdf

TESS_EXE = os.environ.get('TESSERACT_EXE', r'C:/Program Files/Tesseract-OCR/tesseract.exe')
TESSDATA = os.environ.get('TESSDATA_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tessdata'))
LANGS = 'hin+eng'
DEV = re.compile(r'[\u0900-\u097F]')


def available():
    return os.path.isfile(TESS_EXE) and os.path.isfile(os.path.join(TESSDATA, 'hin.traineddata'))


def _clean(t):
    t = unicodedata.normalize('NFC', t or '')
    t = t.replace('|', ' ').replace('\u200c', '').replace('\u200b', '')
    t = re.sub(r'\s+', ' ', t)
    return t.strip()


def devanagari_ratio(t):
    letters = re.findall(r'[A-Za-z\u0900-\u097F]', t or '')
    if not letters:
        return 0.0
    return len(DEV.findall(t)) / len(letters)


def _padded(pix, margin=24):
    """white margin around the image (Tesseract reads text touching the border badly)."""
    doc = pymupdf.open()
    pg = doc.new_page(width=pix.width + 2 * margin, height=pix.height + 2 * margin)
    pg.insert_image(pymupdf.Rect(margin, margin, margin + pix.width, margin + pix.height), pixmap=pix)
    return pg.get_pixmap()


def _run(args, timeout):
    # one thread per Tesseract call: many papers run in parallel, so extra OpenMP threads only oversubscribe the CPU
    env = dict(os.environ, OMP_THREAD_LIMIT='1')
    r = subprocess.run([TESS_EXE] + args, capture_output=True, timeout=timeout, env=env,
                       creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    return r.stdout.decode('utf-8', 'replace')


def ocr_batch(pixmaps, psm=6, timeout=300):
    """OCR several images in one Tesseract call (the model is loaded once). Returns one text per image."""
    if not pixmaps:
        return []
    with tempfile.TemporaryDirectory() as td:
        paths = []
        for i, p in enumerate(pixmaps):
            fp = os.path.join(td, f'{i:04d}.png')
            _padded(p).save(fp)
            paths.append(fp)
        lst = os.path.join(td, 'list.txt')
        with open(lst, 'w', encoding='utf-8') as fh:
            fh.write('\n'.join(paths) + '\n')
        out = _run([lst, 'stdout', '--tessdata-dir', TESSDATA, '-l', LANGS, '--psm', str(psm)], timeout)
        parts = out.split('\f')
        if len(parts) >= len(paths) and len(parts) <= len(paths) + 1:
            return [_clean(t) for t in parts[:len(paths)]]
        # unexpected page split: fall back to one call per image
        res = []
        for fp in paths:
            res.append(_clean(_run([fp, 'stdout', '--tessdata-dir', TESSDATA, '-l', LANGS, '--psm', str(psm)], 120)))
        return res


MARGIN = 24


def ocr_batch_words(pixmaps, psm=6, timeout=300):
    """OCR several images in one call. Returns, per image, a list of words:
    (text, conf, x0, y0, x1, y1, line_key) with coordinates in the original pixmap's pixels."""
    if not pixmaps:
        return []
    with tempfile.TemporaryDirectory() as td:
        paths = []
        for i, p in enumerate(pixmaps):
            fp = os.path.join(td, f'{i:04d}.png')
            _padded(p, MARGIN).save(fp)
            paths.append(fp)
        lst = os.path.join(td, 'list.txt')
        with open(lst, 'w', encoding='utf-8') as fh:
            fh.write('\n'.join(paths) + '\n')
        out = _run([lst, 'stdout', '--tessdata-dir', TESSDATA, '-l', LANGS, '--psm', str(psm), 'tsv'], timeout)
    res = [[] for _ in pixmaps]
    for row in out.splitlines()[1:]:
        c = row.rstrip('\r').split('\t')
        if len(c) < 12 or c[0] != '5' or not c[11].strip():
            continue
        page = int(c[1]) - 1
        if not 0 <= page < len(res):
            continue
        x, y, w, h = int(c[6]) - MARGIN, int(c[7]) - MARGIN, int(c[8]), int(c[9])
        res[page].append((unicodedata.normalize('NFC', c[11].strip()), float(c[10]), x, y, x + w, y + h,
                          (int(c[2]), int(c[3]), int(c[4]))))
    return res


NUMLIKE = re.compile(r'^[\dA-Za-z०-९.,:;%₹/()\-+=×÷√°]+$')
LEAD = re.compile(r'^([\dA-Za-z०-९.,%₹/()\-+]+)(?=[ऀ-ॿ])')


def merge_words(tess_words, win_words, good=70.0):
    """Tesseract is reliable on Devanagari but drops/misreads digits ("1200" -> "200"); Windows OCR reads digits
    and Latin well. Keep confident Tesseract words; for weak number/Latin words use the Windows word at the same
    position. Returns (text, score) where score = share of words that are confident or replaced."""
    if not tess_words:
        return '', 0.0
    out, ok = [], 0
    prev_line = None
    for (t, conf, x0, y0, x1, y1, line) in tess_words:
        new = t
        good_word = conf >= good
        if not good_word:
            best, best_ov = None, 0.0
            for (wt, a0, b0, a1, b1) in win_words:
                ov = max(0, min(x1, a1) - max(x0, a0)) * max(0, min(y1, b1) - max(y0, b0))
                if ov > best_ov:
                    best, best_ov = wt, ov
            area = max(1, (x1 - x0) * (y1 - y0))
            if best and best_ov >= 0.3 * area:
                if NUMLIKE.match(t) and NUMLIKE.match(best):
                    new, good_word = best, True
                elif LEAD.match(t):
                    m = re.match(r'^[\d.,%₹/]+', best)
                    if m:
                        new, good_word = m.group(0) + t[LEAD.match(t).end():], True
        new = re.sub(r'^र(?=\d)', '₹', new)  # ₹ is read as "र" before digits
        if line != prev_line and out:
            out.append(' ')
        elif out:
            out.append(' ')
        out.append(new)
        prev_line = line
        ok += 1 if good_word else 0
    text = re.sub(r'\s+', ' ', ''.join(out)).strip()
    return text, ok / len(tess_words)


def ocr_page_lines(pix, timeout=300):
    """Full-page OCR with line boxes: [(text, x0, y0, x1, y1)] in pixmap pixels."""
    with tempfile.TemporaryDirectory() as td:
        fp = os.path.join(td, 'page.png')
        pix.save(fp)
        tsv = _run([fp, 'stdout', '--tessdata-dir', TESSDATA, '-l', LANGS, '--psm', '4', 'tsv'], timeout)
    lines = {}
    for row in tsv.splitlines()[1:]:
        c = row.split('\t')
        if len(c) < 12 or c[0] != '5' or not c[11].strip():
            continue
        key = (int(c[2]), int(c[3]), int(c[4]))
        x, y, w, h = int(c[6]), int(c[7]), int(c[8]), int(c[9])
        ln = lines.setdefault(key, [[], x, y, x + w, y + h])
        ln[0].append(c[11])
        ln[1] = min(ln[1], x); ln[2] = min(ln[2], y); ln[3] = max(ln[3], x + w); ln[4] = max(ln[4], y + h)
    out = []
    for words, x0, y0, x1, y1 in sorted(lines.values(), key=lambda v: (v[2], v[1])):
        t = _clean(' '.join(words))
        if t:
            out.append((t, x0, y0, x1, y1))
    return out
