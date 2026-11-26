"""Merge per-file extraction results into questions.json + extraction_report.txt and validate."""
import os, sys, json, re, collections

pdf_dir, out_dir, dest = sys.argv[1], sys.argv[2], sys.argv[3]
pdfs = sorted(f for f in os.listdir(pdf_dir) if f.lower().endswith('.pdf'))

ORDER = ['examTag', 'question', 'options', 'correctAnswer', 'explanation', 'questionHi', 'optionsHi',
         'correctAnswerHi', 'explanationHi', 'sourceFile', 'pageNumber', 'questionNumber', 'validation',
         # extra metadata
         'hasImage', 'questionImages', 'optionImages', 'passageImages', 'sourceNote', 'ocrRawText', 'ocrConfidence',
         'language', 'correctOptionNumber', 'section', 'passage', 'extractionMethod',
         'examName', 'examStage', 'examLevel', 'payLevel', 'subject', 'examDate', 'examYear', 'examDateSource',
         'examTime', 'shift', 'recruitmentYear', 'cenNumber', 'documentType', 'paperLanguage', 'sourceTotalPages']

STOP = set(('the of is in which a an to and what following from for are was be by that given on with as at who '
            'find if its this select it his her not one many number how when where most first has have can will '
            'all some no only these those their they were been between into among than then also each other').split())
PLACEHOLDER = '[IMAGE: no OCR text]'
HINDI_OCR_MIN_CONF = 0.8

def unreadable_english(t):
    """OCR garbage test for English text: real sentences contain common words and few stray symbols."""
    words = re.findall(r'[A-Za-z]+', t)
    if len(words) >= 8 and sum(w.lower() in STOP for w in words) / len(words) < 0.1:
        return True
    body = t.replace(PLACEHOLDER, '')
    junk = len(re.findall(r'[^\w\s.,?!\'"()\[\]%:;/\-+=×÷<>°₹&@#*$^|{}~`’‘“”–—…]', body))
    return len(body) > 20 and junk / len(body) > 0.15

def skip_reasons(x):
    """questions that cannot be read reliably are kept out of questions.json and logged for manual review."""
    why = []
    v = x.get('validation', '')
    hi = x.get('language') == 'hi'
    q = (x['questionHi'] if hi else x['question']).strip()
    opts = x['optionsHi'] if hi else x['options']
    oimgs = x.get('optionImages') or []
    if 'Hindi text printed as image could not be OCR-read' in v:
        why.append('Hindi text printed as image (not machine-readable here)')
    conf = x.get('ocrConfidence')
    if conf is not None and conf < HINDI_OCR_MIN_CONF:
        why.append(f'Hindi OCR not confident enough (ocrConfidence < {HINDI_OCR_MIN_CONF})')
    if not q.replace(PLACEHOLDER, '').strip() and not x.get('questionImages'):
        why.append('question text missing')
    elif not q.replace(PLACEHOLDER, '').strip():
        why.append('question text not readable (only image)')
    if len(opts) != 4:
        why.append(f'{len(opts)} options found (expected 4)')
    for i, o in enumerate(opts):
        has_img = i < len(oimgs) and bool(oimgs[i])
        if (not o.strip() or o.strip() == PLACEHOLDER) and not has_img:
            why.append(f'option {i + 1} text missing'); break
    if 'answer-row letters as printed' in v or 'could not be resolved' in v:
        why.append('option texts only inside the image (letter mapping not resolved)')
    if not (x['correctAnswer'] or x['correctAnswerHi']) and x.get('correctOptionNumber') is None:
        why.append('correct answer not identified')
    if x.get('extractionMethod') in ('ocr', 'text+ocr') and not hi:
        if unreadable_english(q) or sum(unreadable_english(o) for o in opts) >= 2:
            why.append('OCR text unreadable (poor scan / overlap)')
    return why

allrecs = []; skipped = []; per_file = []; missing = []; fatal = []
for f in pdfs:
    p = os.path.join(out_dir, f + '.json')
    if not os.path.exists(p):
        missing.append(f); continue
    r = json.load(open(p, encoding='utf-8'))
    if r.get('fatal'):
        fatal.append((f, r['fatal'].strip().splitlines()[-1])); continue
    recs = r['records']
    nums = [x['questionNumber'] for x in recs]
    # paper length: 120 if questions 101-120 are present (CBT-2 / 2015 papers), else 100; for longer
    # numbering (several sections numbered on), the highest number that is followed by no big jump
    hi = sorted(set(n for n in nums if n > 0))
    if sum(100 < n <= 120 for n in hi) >= 5:
        expected = 120
    else:
        expected = 100
    if sum(120 < n <= 240 for n in hi) >= 20:
        expected = max(n for n in hi if n <= 240)
    c = collections.Counter(nums)
    # sections numbered separately (e.g. 1-40, 1-30, 1-30): numbering restarting at 1 starts a new section
    segs = [[]]
    for k in nums:
        if segs[-1] and k <= 3 and segs[-1][-1] >= 20:
            segs.append([])
        segs[-1].append(k)
    if len(segs) > 1 and all(len(s) >= 10 for s in segs):
        expected = sum(max(s) for s in segs)
        gaps, dups, outside = [], [], []
        for si, sg in enumerate(segs, 1):
            cs = collections.Counter(sg)
            gaps += [f's{si}:{n}' for n in range(1, max(sg) + 1) if n not in cs]
            dups += [f's{si}:{n}' for n, k in cs.items() if k > 1]
        gaps = gaps; dups = sorted(dups)
    else:
        dups = sorted(n for n, k in c.items() if k > 1)
        gaps = [n for n in range(1, expected + 1) if n not in c]
        outside = sorted(n for n in c if n < 1 or n > expected)
    methods = collections.Counter(m for _, m, _ in r['page_methods'])
    per_file.append(dict(file=f, n=len(recs), expected=expected, gaps=gaps, dups=dups, outside=outside, methods=dict(methods),
                         issues=r['issues'], meta=r.get('meta', {}),
                         ok=sum(x['validation'] == 'ok' for x in recs),
                         noans=sum(not (x['correctAnswer'] or x['correctAnswerHi']) for x in recs),
                         badopts=sum(len(x['options'] or x['optionsHi']) != 4 for x in recs),
                         adverts=[p for p, m, _ in r['page_methods'] if m == 'advert'],
                         blank=[p for p, m, _ in r['page_methods'] if m == 'blank'],
                         errpages=[p for p, m, _ in r['page_methods'] if m == 'error']))
    for x in recs:
        x.pop('sourceFilePath', None)
        extra = [k for k in x if k not in ORDER]
        rec = {k: x.get(k) for k in ORDER + extra if k in x}
        why = skip_reasons(rec)
        if why:
            rec['skipReasons'] = why
            skipped.append(rec)
        else:
            allrecs.append(rec)

# image path verification
img_refs = 0; img_missing = []; img_files = set()
for x in allrecs + skipped:
    paths = list(x.get('questionImages') or []) + [p for o in (x.get('optionImages') or []) for p in o] + list(x.get('passageImages') or [])
    for p in paths:
        img_refs += 1; img_files.add(p)
        if not os.path.exists(os.path.join(dest, p)):
            img_missing.append((x['sourceFile'], x['questionNumber'], p))
img_bytes = sum(os.path.getsize(os.path.join(dest, p)) for p in img_files if os.path.exists(os.path.join(dest, p)))
with open(os.path.join(dest, 'questions.json'), 'w', encoding='utf-8') as fh:
    json.dump(allrecs, fh, ensure_ascii=False, indent=1)
# verify it parses
parsed = json.load(open(os.path.join(dest, 'questions.json'), encoding='utf-8'))
assert len(parsed) == len(allrecs)
# skipped (hard to read) questions: full records + a CSV for quick manual review
with open(os.path.join(dest, 'skipped_questions.json'), 'w', encoding='utf-8') as fh:
    json.dump(skipped, fh, ensure_ascii=False, indent=1)
assert len(json.load(open(os.path.join(dest, 'skipped_questions.json'), encoding='utf-8'))) == len(skipped)
import csv
with open(os.path.join(dest, 'skipped_questions.csv'), 'w', encoding='utf-8-sig', newline='') as fh:
    cw = csv.writer(fh)
    cw.writerow(['sourceFile', 'pageNumber', 'questionNumber', 'skipReasons', 'questionTextAsExtracted',
                 'correctOptionNumber', 'imagePaths'])
    for x in skipped:
        imgs = list(x.get('questionImages') or []) + [p for o in (x.get('optionImages') or []) for p in o]
        cw.writerow([x['sourceFile'], x['pageNumber'], x['questionNumber'], '; '.join(x['skipReasons']),
                     (x['question'] or x['questionHi'])[:300], x.get('correctOptionNumber') or '', ' | '.join(imgs)])

# ---------------------------------------------------------------- report
N = len(allrecs)
ok = sum(x['validation'] == 'ok' for x in allrecs)
withans = sum(bool(x['correctAnswer'] or x['correctAnswerHi']) for x in allrecs)
with_expl = sum(bool(x['explanation'] or x['explanationHi']) for x in allrecs)
lang = collections.Counter(x['language'] for x in allrecs)
meth = collections.Counter(x['extractionMethod'] for x in allrecs)
flagc = collections.Counter()
for x in allrecs:
    if x['validation'] != 'ok':
        for fl in x['validation'][len('review: '):].split('; '):
            flagc[re.sub(r"\(OCR read .*\)", '(OCR read …)', re.sub(r'^\d+ options', 'N options', fl))] += 1
tot_gaps = sum(len(p['gaps']) for p in per_file)
tot_dups = sum(len(p['dups']) for p in per_file)

L = []
w = L.append
w('RRB NTPC QUESTION EXTRACTION REPORT')
w('=' * 70)
w(f'PDF folder              : {pdf_dir}')
w(f'PDFs found              : {len(pdfs)}')
w(f'PDFs processed          : {len(per_file)}')
w(f'PDFs not processed      : {len(missing) + len(fatal)}')
for f in missing: w(f'   - {f}: no output (not processed)')
for f, e in fatal: w(f'   - {f}: FATAL {e}')
skipc = collections.Counter(r for x in skipped for r in x['skipReasons'])
empty_pdfs = [p['file'] for p in per_file if p['n'] == 0]
w(f'PDFs with no questions extracted: {len(empty_pdfs)} (need manual review)')
for f in empty_pdfs:
    w(f'   - {f}: pages are one large image with text overlaid; questions could not be separated')
w(f'Questions found in PDFs : {N + len(skipped)}')
w(f'Saved to questions.json : {N}')
w(f'Skipped (hard to read)  : {len(skipped)}  -> skipped_questions.json / skipped_questions.csv for manual review')
for k, v in skipc.most_common():
    w(f'      {v:7d}  {k}')
w(f'Total questions (questions.json): {N}')
w(f'  validation = ok       : {ok}')
w(f'  flagged for review    : {N - ok}')
w(f'  with correct answer   : {withans}  (blank / needs review: {N - withans})')
w(f'  with explanation      : {with_expl}')
w(f'  language              : ' + ', '.join(f'{k}={v}' for k, v in lang.items()))
w(f'  extraction method     : ' + ', '.join(f'{k}={v}' for k, v in meth.items()))
hindi_papers = [p['file'] for p in per_file if any('Hindi-medium paper' in i for i in p['issues'])]
w(f'Hindi-medium image papers: {len(hindi_papers)} (question text printed as Devanagari images)')
w(f'Questions with images  : {sum(bool(x.get("hasImage")) for x in allrecs)}')
w(f'Image files referenced  : {len(img_files)} distinct ({img_refs} references), {img_bytes/1e6:.0f} MB, folder question_images/')
w(f'Image paths missing     : {len(img_missing)}')
for f, n, p in img_missing[:50]: w(f'   - {f} Q{n}: {p}')
w(f'Question-number gaps    : {tot_gaps} missing numbers across {sum(bool(p["gaps"]) for p in per_file)} files')
w(f'Duplicate numbers       : {tot_dups} across {sum(bool(p["dups"]) for p in per_file)} files')
w('')
w('REVIEW FLAG COUNTS (a question can carry several flags)')
w('-' * 70)
for k, v in flagc.most_common():
    w(f'{v:7d}  {k}')
w('')
w('ASSUMPTIONS / RULES USED')
w('-' * 70)
for s in [
    'Correct answer: these PDFs are RRB/digialm answer-key style sheets whose own legend says "Options shown in green '
    'color with a tick icon are correct". An option is taken as correct only when exactly one option of the question is '
    'green - detected from the text colour of the option (text-layer PDFs) and/or green tick pixels next to the option '
    '(image/scanned PDFs). If no option or more than one option is green, correctAnswer is left blank and the record is flagged.',
    '"Chosen Option" / "Status" printed on candidate response sheets is the candidate\'s choice, NOT the answer, and was ignored.',
    'Re-typed 2016 papers (numbered "1.", options A-D, then rows a-d mapping to letters) have an "N. Answer: x  Explanation: ..." '
    'section at the end. The answer letter (a-d) is resolved through that question\'s a-d -> A-D mapping rows to the option '
    'text; the explanation text is copied verbatim into explanation/explanationHi.',
    'No other PDF family contains explanations, so explanation fields are "" there (nothing was written or invented).',
    'Older response sheets where answer rows read "1. C", "2. A" (letters) have options A-D inside the question image; '
    'those A-D option texts were split out of the question text in A-D order.',
    'Language: a question goes into the *Hi fields if its text/options contain Devanagari, otherwise into the English fields. '
    'Questions with no letters at all (pure numbers) follow the language of the paper. No translation was done; the '
    'Hindi and English papers are separate PDFs and each question is stored once, as it appears in its own PDF.',
    'Hindi text-layer fix: the PDFs\' text layer duplicates some vowel signs (e.g. "हिस्साा" for the rendered "हिस्सा"); '
    'consecutive duplicate vowel signs / anusvara were collapsed so the text matches what is printed. Nothing else was changed.',
    'Line breaks inside a question/option are joined with a single space. Text that the PDF wraps in the middle of a Hindi '
    'word therefore may show a space inside that word (as in the source layout).',
    'Text inside images (questions/options rendered as pictures, formulas, scanned pages) was read with Windows OCR '
    '(English only - no Hindi OCR engine is installed). Every such record is flagged "verify text"; OCR spelling errors are '
    'possible. Images with no readable text (diagrams, figures) are marked "[IMAGE: no OCR text]".',
    'Two stacked short OCR lines in one small image (fractions) are written as "a/b" and flagged.',
    'examTag contains "CBT-1"/"CBT-2" only when the file name or the PDF header names the stage; "Station Master" only when '
    'the PDF says so (it never does in this set). Other metadata (date, time, shift, level, CEN, recruitment year, document '
    'type, paper language, subject/pay level, section) is read from the PDF header first and the file name second; '
    'examDateSource says which.',
    'Images: every picture that is part of a question, option or passage (diagrams, figures, formulas, and questions '
    'printed as pictures) is saved as PNG under question_images/<pdf name>/ and referenced by a path relative to the '
    'folder holding questions.json: questionImages, optionImages (one list per option, same order as options) and '
    'passageImages. For fully scanned pages the question area (question + options) is saved as a crop '
    '(..._scan.png) in questionImages. hasImage is true when any image is attached.',
    'Scanned 2016 response sheets print answer rows as "1. C", "2. A" ...: these letters were read by matching the glyph '
    'against A-D templates and accepted only when the four rows form a valid A-D permutation. If the A-D option texts '
    'could not be read from the scan, options hold those letters and the record is flagged.',
    'Hindi-medium response sheets (2019-2022) print the question and many options as Devanagari images. They are '
    'detected by reading 15 question images with the English OCR engine (real English gives many common English words, '
    'Devanagari gives almost none). Their images are read with Tesseract (Hindi + English models; native image, '
    'greyscale, 3x Lanczos upscale). Tesseract is reliable on Devanagari words but drops/misreads digits, so each '
    'low-confidence number/Latin word is replaced by the Windows OCR word at the same position, and "र" before a number is '
    'corrected to "₹". Every Hindi-OCR question gets ocrConfidence = share of words read confidently (lowest over its '
    'question and option images); only questions with ocrConfidence >= 0.8 go to questions.json, the rest are skipped '
    'and logged. Fully scanned Hindi pages could not be read reliably and are always skipped.',
    'correctOptionNumber (1-4) is given whenever exactly one option is marked green, even when the option text itself is '
    'an image; use it together with optionImages.',
    'Hard-to-read questions are NOT in questions.json. A question is skipped when: its Hindi text is only in an image, '
    'the question text is missing, fewer/more than 4 options or an option text is missing (and no option image), the '
    'correct answer could not be identified, or the OCR text is unreadable (scan quality / logo overlap). Each skipped '
    'question is listed with file, page, question number, reason and image paths in skipped_questions.json and '
    'skipped_questions.csv, for manual review later.',
    'Duplicate PDFs (same paper saved twice under two names) were NOT de-duplicated, as requested.',
    'Pages that are pure adverts (Adda247 promo pages) are skipped and listed per file below; blank pages likewise.',
    'OCR question numbers that were obviously misread (e.g. "Q.IO") were repaired only when the previous and next '
    'question numbers prove the value; such records are flagged.',
]:
    w('* ' + s)
w('')
w('PER-FILE SUMMARY (files needing review first)')
w('-' * 70)
def score(p):
    return (p['n'] - p['ok']) + 5 * len(p['gaps'])
for p in sorted(per_file, key=score, reverse=True):
    m = p['meta']
    w(f"{p['file']}")
    w(f"   questions={p['n']} expected={p['expected']} ok={p['ok']} no_answer={p['noans']} not_4_options={p['badopts']} "
      f"pages={dict(p['methods'])} date={m.get('examDate','')} stage={m.get('examStage','')} level={m.get('examLevel','')} "
      f"lang={m.get('paperLanguage','')}")
    if p['gaps']: w(f"   MISSING question numbers: {p['gaps']}")
    if p['dups']: w(f"   duplicate question numbers: {p['dups']}")
    sk = [x for x in skipped if x['sourceFile'] == p['file']]
    if sk: w(f"   skipped (hard to read): {len(sk)} -> questions {sorted(x['questionNumber'] for x in sk)}")
    if p['outside']: w(f"   numbers outside 1-{p['expected']} (likely OCR misreads): {p['outside']}")
    if p['adverts']: w(f"   advert pages skipped: {p['adverts']}")
    if p['blank']: w(f"   blank pages: {p['blank']}")
    if p['errpages']: w(f"   PAGES WITH EXTRACTION ERRORS: {p['errpages']}")
    for i in p['issues']: w(f"   note: {i}")
with open(os.path.join(dest, 'extraction_report.txt'), 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(L) + '\n')
print('\n'.join(L[:40]))
