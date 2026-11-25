"""Build the Previous-Year-Question (PYQ) dataset for the app from the extraction output.

Input : <RRB folder>/questions.json  (+ question_images/)   produced by the PDF extraction
Output: public/pyq/index.json        papers + compact per-question index (loaded at start of the PYQ tab)
        public/pyq/c/<chunk>.json    question bodies, grouped by year + section (loaded on demand)
        public/pyq/img/...           only the images a question actually needs (diagrams / formulas / scans)
        public/pyq/build_report.json numbers for docs and checks

Usage : python scripts/build_pyq.py <folder containing questions.json and question_images/>
"""
import collections
import hashlib
import json
import math
import os
import random
import re
import shutil
import sys
import unicodedata

if len(sys.argv) < 2:
    sys.exit(__doc__)
SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'pyq')
PLACEHOLDER = '[IMAGE: no OCR text]'
CATS = ['General Awareness', 'Mathematics', 'General Intelligence & Reasoning']
SECTION_MAP = {
    'general awareness': 0, 'mathematics': 1, 'general intelligence and reasoning': 2,
}
CHUNK_MAX = 1200

DEV = re.compile(r'[\u0900-\u097F]')


def norm_key(s):
    s = unicodedata.normalize('NFC', s or '').lower()
    return re.sub(r'[\W_]+', '', s)


def tokens(text):
    t = (text or '').lower()
    toks = re.findall(r'[a-z]+|[\u0900-\u097F]+', t)
    feats = list(toks)
    feats += [a + '_' + b for a, b in zip(toks, toks[1:])]
    nums = re.findall(r'\d+', t)
    feats.append('#nums%d' % min(len(nums), 6))
    for sym, name in (('%', 'pct'), ('₹', 'rs'), ('rs.', 'rs'), ('km', 'km'), ('?', 'qmark'), (':', 'colon'),
                      ('=', 'eq'), ('×', 'mul'), ('÷', 'div'), ('√', 'sqrt'), ('°', 'deg'), ('/', 'slash')):
        if sym in t:
            feats.append('#' + name)
    return feats


class NaiveBayes:
    def __init__(self, n):
        self.n = n; self.counts = [collections.Counter() for _ in range(n)]; self.docs = [0] * n

    def fit(self, X, y):
        for f, c in zip(X, y):
            self.docs[c] += 1; self.counts[c].update(f)
        self.vocab = set().union(*self.counts)
        self.tot = [sum(c.values()) for c in self.counts]
        self.prior = [math.log(d / sum(self.docs)) for d in self.docs]

    def predict(self, f):
        V = len(self.vocab)
        best, scores = None, []
        for c in range(self.n):
            s = self.prior[c]
            for w in f:
                if w in self.vocab:
                    s += math.log((self.counts[c][w] + 1) / (self.tot[c] + V))
            scores.append(s)
        m = max(scores)
        ps = [math.exp(s - m) for s in scores]; z = sum(ps)
        c = scores.index(m)
        return c, ps[c] / z


def jaccard(a, b):
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def shingles(s, k=5):
    s = norm_key(s)
    return {s[i:i + k] for i in range(max(1, len(s) - k + 1))}


def main():
    recs = json.load(open(os.path.join(SRC, 'questions.json'), encoding='utf-8'))
    report = collections.Counter()
    report['input_records'] = len(recs)

    # ------------------------------------------------------------------ clean + usable records
    usable = []
    for r in recs:
        hi = r['language'] == 'hi'
        q = (r['questionHi'] if hi else r['question']) or ''
        opts = list(r['optionsHi'] if hi else r['options'])
        corr = (r['correctAnswerHi'] if hi else r['correctAnswer']) or ''
        ci = r.get('correctOptionNumber')
        ci = (ci - 1) if ci else (opts.index(corr) if corr in opts else None)
        if ci is None or len(opts) != 4:
            report['dropped_no_answer_or_options'] += 1; continue
        oimgs = r.get('optionImages') or [[] for _ in opts]
        # options that exist only as an image get a distinct label; the image is shipped with the question
        for i, o in enumerate(opts):
            if (not o.strip() or o.strip() == PLACEHOLDER):
                opts[i] = f'[Option {i + 1}: see image]'
        if len(set(o.strip() for o in opts)) < 4:
            report['dropped_duplicate_option_text'] += 1; continue
        q_clean = q.replace(PLACEHOLDER, '').strip()
        r['_q'], r['_opts'], r['_ci'], r['_hi'] = q_clean, opts, ci, hi
        r['_needq'] = PLACEHOLDER in q or 'fraction' in r['validation']
        r['_needo'] = [i < len(oimgs) and bool(oimgs[i]) and (PLACEHOLDER in (r['optionsHi'] if hi else r['options'])[i]
                       or not (r['optionsHi'] if hi else r['options'])[i].strip()
                       or ('fraction' in r['validation'] and '/' in opts[i])) for i in range(4)]
        usable.append(r)
    report['usable_records'] = len(usable)

    # ------------------------------------------------------------------ section (category)
    X, y = [], []
    for r in usable:
        s = (r['section'] or '').strip().lower()
        r['_cat'] = SECTION_MAP.get(s)
        r['_catsrc'] = 'paper'
        r['_feats'] = tokens(r['_q'] + ' ' + ' '.join(r['_opts']))
        if r['_cat'] is not None:
            X.append(r['_feats']); y.append(r['_cat'])
    # hold-out accuracy
    idx = list(range(len(X))); random.Random(42).shuffle(idx)
    cut = int(len(idx) * 0.85)
    nb = NaiveBayes(3); nb.fit([X[i] for i in idx[:cut]], [y[i] for i in idx[:cut]])
    test = idx[cut:]
    acc = sum(nb.predict(X[i])[0] == y[i] for i in test) / max(1, len(test))
    report['section_classifier_holdout_accuracy_pct'] = round(acc * 100, 1)
    report['section_classifier_holdout_size'] = len(test)
    nb = NaiveBayes(3); nb.fit(X, y)
    REASON = re.compile(r'(series|coded?|code language|letter[- ]?clusters?|letter-number|venn|mirror image|water image|'
                        r'analogy|odd one|statements?|conclusions?|alphabetical|dictionary order|sitting|seated|'
                        r'facing (the )?(centre|center|north|south|east|west)|dice|embedded|syllogism|blood relation|'
                        r'arrangement|related to|course of action|assumptions?)|श्रृंखला|श्रेणी|कूट|कथन|निष्कर्ष|वेन|'
                        r'दर्पण|सादृश्य|विषम|बैठ|अक्षर-समूह|वर्णमाला', re.I)
    for r in usable:
        if r['_cat'] is None and REASON.search(r['_q']):
            r['_cat'], r['_catsrc'] = 2, 'inferred'
            report['section_inferred_by_keyword'] += 1
            report['section_inferred'] += 1
            continue
        if r['_cat'] is None:
            c, p = nb.predict(r['_feats'])
            r['_cat'], r['_catsrc'], r['_catp'] = c, 'inferred', round(p, 3)
            report['section_inferred'] += 1
        else:
            report['section_from_paper'] += 1

    # ------------------------------------------------------------------ papers / sittings
    papers = {}
    for r in usable:
        f = r['sourceFile']
        if f not in papers:
            papers[f] = dict(file=f, date=r.get('examDate') or '', year=r.get('examYear'), stage=r.get('examStage') or '',
                             level=r.get('examLevel') or '', shift=r.get('shift'), time=r.get('examTime') or '',
                             lang=r.get('paperLanguage') or '', doc=r.get('documentType') or '',
                             cen=r.get('cenNumber') or '', rec=r.get('recruitmentYear'), qids=[])
    plist = sorted(papers.values(), key=lambda p: (p['date'], str(p['shift']), p['file']))
    pidx = {p['file']: i for i, p in enumerate(plist)}

    def start_time(t):
        m = re.search(r'(\d{1,2})[.:](\d{2})\s*-?\s*(am|pm)?', t or '', re.I)
        if not m:
            return ''
        h, mi, ap = int(m.group(1)), m.group(2), (m.group(3) or '').lower()
        if not ap:
            ap = 'am' if 8 <= h <= 11 else 'pm'
        return f'{h}:{mi}{ap}'

    def sitting_of(p):
        st = start_time(p['time'])
        return (p['date'] or p['file'], st if st else 'shift' + str(p['shift']))

    def sitting(r):
        return sitting_of(papers[r['sourceFile']])

    sit_keys = sorted({sitting_of(p) for p in plist})
    sit_idx = {k: i for i, k in enumerate(sit_keys)}
    sit_meta = {}
    for p in plist:
        k = sitting_of(p)
        m = sit_meta.setdefault(k, dict(d=p['date'], y=p['year'], t=p['time'], sh=p['shift'], s='', lv='', cen='', files=[]))
        m['files'].append(pidx[p['file']])
        for a, b in (('s', 'stage'), ('lv', 'level'), ('cen', 'cen'), ('t', 'time')):
            if not m[a] and p[b]:
                m[a] = p[b]
        if m['sh'] is None and p['shift'] is not None:
            m['sh'] = p['shift']

    # ------------------------------------------------------------------ duplicate groups (union-find)
    parent = list(range(len(usable)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a

    def union(a, b):
        a, b = find(a), find(b)
        if a != b:
            parent[b] = a

    def same_answer(a, b):
        return norm_key(a['_opts'][a['_ci']]) == norm_key(b['_opts'][b['_ci']])

    exact = collections.defaultdict(list)
    by_opts = collections.defaultdict(list)
    by_head = collections.defaultdict(list)
    for i, r in enumerate(usable):
        ok = '|'.join(sorted(norm_key(o) for o in r['_opts']))
        exact[norm_key(r['_q'])[:400] + '#' + ok].append(i)
        if len(norm_key(r['_q'])) >= 25:
            by_opts[ok].append(i)
            by_head[norm_key(r['_q'])[:40]].append(i)
    for ids in exact.values():
        for j in ids[1:]:
            if same_answer(usable[ids[0]], usable[j]):
                union(ids[0], j)
    sh = {}
    def shs(i):
        if i not in sh:
            sh[i] = shingles(usable[i]['_q'])
        return sh[i]
    near = 0
    for bucket in list(by_opts.values()) + list(by_head.values()):
        if len(bucket) < 2 or len(bucket) > 60:
            continue
        for a in range(len(bucket)):
            for b in range(a + 1, len(bucket)):
                i, j = bucket[a], bucket[b]
                if find(i) == find(j):
                    continue
                if jaccard(shs(i), shs(j)) >= 0.8 and same_answer(usable[i], usable[j]):
                    oi = sorted(norm_key(o) for o in usable[i]['_opts']); oj = sorted(norm_key(o) for o in usable[j]['_opts'])
                    if sum(x == y2 for x, y2 in zip(oi, oj)) >= 3 or jaccard(set(oi), set(oj)) >= 0.6:
                        union(i, j); near += 1
    report['near_duplicate_merges'] = near
    groups = collections.defaultdict(list)
    for i in range(len(usable)):
        groups[find(i)].append(i)
    report['unique_questions'] = len(groups)

    # ------------------------------------------------------------------ build question bodies
    rank = {'text': 0, 'text+ocr': 1, 'ocr': 2}
    questions = []
    used_ids = set()
    img_copy = {}
    for g in groups.values():
        members = [usable[i] for i in g]
        rep = min(members, key=lambda r: (rank.get(r['extractionMethod'], 3), r['validation'] != 'ok',
                                          not (r['explanation'] or r['explanationHi']), r['sourceFile']))
        key = norm_key(rep['_q'])[:400] + '#' + '|'.join(sorted(norm_key(o) for o in rep['_opts']))
        qid = 'PYQ_' + hashlib.sha1(key.encode('utf-8')).hexdigest()[:10]
        if qid in used_ids:
            # same text but the source papers mark a different answer: keep both, with a stable distinct id
            qid += '_' + hashlib.sha1(f"{rep['sourceFile']}#{rep['questionNumber']}".encode('utf-8')).hexdigest()[:4]
            report['same_text_different_answer'] += 1
        used_ids.add(qid)
        apps = []
        seen_ap = set()
        for m in members:
            k = (pidx[m['sourceFile']], m['questionNumber'])
            if k not in seen_ap:
                seen_ap.add(k); apps.append([pidx[m['sourceFile']], m['questionNumber'], m['pageNumber']])
        sittings = {sitting(m) for m in members}
        years = sorted({m.get('examYear') for m in members if m.get('examYear')})

        def rel_img(p):
            stem_file = p.split('/', 1)[1]
            out = 'img/' + stem_file
            if p.endswith('_scan.png') or '_scan_p' in p:
                out = out[:-4] + '.jpg'
            img_copy[p] = out
            return out
        qimgs = [rel_img(p) for p in rep['questionImages']] if (rep['_needq'] or rep['extractionMethod'] == 'ocr') else []
        oimgs_src = rep.get('optionImages') or []
        oimgs = [[rel_img(p) for p in oimgs_src[i]] if (i < len(oimgs_src) and rep['_needo'][i]) else [] for i in range(4)]
        pimgs = [rel_img(p) for p in rep.get('passageImages') or []]
        expl = (rep['explanationHi'] if rep['_hi'] else rep['explanation']) or ''
        flags = []
        if rep['extractionMethod'] != 'text':
            flags.append('ocr')
        if rep['_catsrc'] == 'inferred':
            flags.append('sec-inferred')
        if len(members) > 1 and any(m['validation'] != 'ok' for m in members):
            pass
        body = dict(id=qid, c=rep['_cat'], l='hi' if rep['_hi'] else 'en', q=rep['_q'], o=rep['_opts'], a=rep['_ci'])
        if expl:
            body['e'] = expl
        if rep.get('passage'):
            body['p'] = rep['passage']
        if qimgs:
            body['qi'] = qimgs
        if any(oimgs):
            body['oi'] = oimgs
        if pimgs:
            body['pi'] = pimgs
        if flags:
            body['f'] = flags
        if rep.get('sourceNote'):
            body['n'] = rep['sourceNote']
        questions.append(dict(body=body, apps=apps, rep_sittings=len(sittings), years=years,
                              first_year=years[0] if years else 0, stages=sorted({m.get('examStage') for m in members if m.get('examStage')})))
        for a in apps:
            plist[a[0]]['qids'].append((a[1], qid))

    # ------------------------------------------------------------------ chunking
    questions.sort(key=lambda x: (x['first_year'], x['body']['c'], x['body']['id']))
    chunks = collections.defaultdict(list)
    for x in questions:
        chunks[(x['first_year'], x['body']['c'])].append(x)
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, 'c'))
    chunk_names = []
    qindex = []
    for (yr, c), xs in sorted(chunks.items()):
        for k in range(0, len(xs), CHUNK_MAX):
            part = xs[k:k + CHUNK_MAX]
            name = f'{yr or "na"}_{["ga", "math", "reas"][c]}_{k // CHUNK_MAX + 1}'
            ci = len(chunk_names); chunk_names.append(name)
            with open(os.path.join(OUT, 'c', name + '.json'), 'w', encoding='utf-8') as fh:
                json.dump([x['body'] for x in part], fh, ensure_ascii=False, separators=(',', ':'))
            for x in part:
                b = x['body']
                fl = (1 if (b.get('qi') or b.get('oi') or b.get('pi')) else 0) | (2 if 'ocr' in b.get('f', []) else 0) \
                    | (4 if 'sec-inferred' in b.get('f', []) else 0) | (8 if b.get('e') else 0)
                qindex.append([b['id'], ci, b['c'], 0 if b['l'] == 'en' else 1, x['rep_sittings'], fl,
                               [a[0] for a in x['apps']]])

    # ------------------------------------------------------------------ images
    from PIL import Image
    img_bytes = 0
    for src, rel in img_copy.items():
        dst = os.path.join(OUT, rel.replace('/', os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        s = os.path.join(SRC, src.replace('/', os.sep))
        if rel.endswith('.jpg'):
            im = Image.open(s).convert('RGB')
            if im.width > 1100:
                im = im.resize((1100, round(im.height * 1100 / im.width)))
            im.save(dst, 'JPEG', quality=72, optimize=True)
        else:
            shutil.copyfile(s, dst)
        img_bytes += os.path.getsize(dst)
    report['images_shipped'] = len(img_copy)
    report['images_mb'] = round(img_bytes / 1e6, 1)

    # ------------------------------------------------------------------ papers (original order kept for replay)
    out_papers = []
    for p in plist:
        order = [qid for _, qid in p['qids']]
        seen_o = set(); order = [q for q in order if not (q in seen_o or seen_o.add(q))]
        k = sitting_of(p); m = sit_meta[k]
        out_papers.append(dict(f=p['file'], d=p['date'], y=p['year'], s=p['stage'] or m['s'], lv=p['level'] or m['lv'],
                               sh=p['shift'] if p['shift'] is not None else m['sh'], t=p['time'] or m['t'], lg=p['lang'],
                               dt=p['doc'], cen=p['cen'] or m['cen'], ry=p['rec'], si=sit_idx[k], q=order))
    sittings = []
    for k in sit_keys:
        m = sit_meta[k]
        sittings.append(dict(d=m['d'], y=m['y'], t=m['t'], sh=m['sh'], s=m['s'], lv=m['lv'], cen=m['cen'], p=m['files']))
    index = dict(version=2, cats=CATS, chunks=chunk_names, sittings=sittings, papers=out_papers, questions=qindex)
    report['sittings'] = len(sittings)
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(',', ':'))

    rep_hist = collections.Counter(x['rep_sittings'] for x in questions)
    report['asked_in_2plus_exams'] = sum(v for k, v in rep_hist.items() if k >= 2)
    report['asked_in_3plus_exams'] = sum(v for k, v in rep_hist.items() if k >= 3)
    report['repeat_histogram'] = dict(sorted(rep_hist.items()))
    report['papers'] = len(out_papers)
    report['chunks'] = len(chunk_names)
    report['by_year'] = dict(sorted(collections.Counter(y for x in questions for y in x['years']).items()))
    report['by_section'] = {CATS[k]: v for k, v in sorted(collections.Counter(x['body']['c'] for x in questions).items())}
    report['by_language'] = dict(collections.Counter(x['body']['l'] for x in questions))
    report['index_kb'] = round(os.path.getsize(os.path.join(OUT, 'index.json')) / 1024)
    report['chunks_mb'] = round(sum(os.path.getsize(os.path.join(OUT, 'c', n + '.json')) for n in chunk_names) / 1e6, 1)
    with open(os.path.join(OUT, 'build_report.json'), 'w', encoding='utf-8') as fh:
        json.dump(report, fh, ensure_ascii=False, indent=1)
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
