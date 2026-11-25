"""Extract RRB NTPC questions from one PDF into a per-file JSON (records + issues).

Usage: python -P extract.py <pdf_dir> <out_dir> [file ...]   (no files => all PDFs, multiprocess)
"""
import os, re, sys, json, asyncio, traceback, unicodedata, time
import pymupdf
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glyph

pymupdf.TOOLS.mupdf_display_errors(False)

# ---------------------------------------------------------------- OCR (Windows.Media.Ocr, English)
_eng = None
OCR_LANG = ['en-US']          # switched to 'hi' for Hindi-medium image papers when Windows has Hindi OCR
_engs = {}
def _engine():
    global _eng
    lang = OCR_LANG[0]
    if _eng is None or lang not in _engs:
        from winrt.windows.media.ocr import OcrEngine
        from winrt.windows.globalization import Language
        _engs[lang] = OcrEngine.try_create_from_language(Language(lang))
        _eng = _engs[lang]
    return _engs[lang]

def hindi_ocr_available():
    try:
        from winrt.windows.media.ocr import OcrEngine
        from winrt.windows.globalization import Language
        return bool(OcrEngine.is_language_supported(Language('hi')))
    except Exception:
        return False

STOPWORDS = set(('the of is in which a an to and what following from for are was be by that given on with as at '
                 'who find if its this select it his her not one many number').split())

def probe_hindi_images(doc, maxn=15):
    """Hindi-medium response sheets print the question text as images. Read up to 15 question images with the
    English OCR engine: real English yields many common English words, Devanagari yields few/garbage tokens."""
    toks = hits = n = 0
    for p in range(min(2, doc.page_count - 1), min(doc.page_count, 14)):
        pg = doc[p]
        for im in pg.get_image_info():
            x0, y0, x1, y1 = im['bbox']
            if x1 - x0 > 200 and 8 < y1 - y0 < 60:
                pix = pg.get_pixmap(matrix=pymupdf.Matrix(3, 3), clip=pymupdf.Rect(x0 - 2, y0 - 2, x1 + 2, y1 + 2))
                w = re.findall(r'[a-z]+', ' '.join(t for t, *_r in ocr_pix(pix)).lower())
                toks += len(w); hits += sum(x in STOPWORDS for x in w); n += 1
            if n >= maxn:
                break
        if n >= maxn:
            break
    if n < 5:
        return False, n, toks, 0.0
    ratio = hits / max(toks, 1)
    return (toks < 8 * n or ratio < 0.2), n, toks, ratio

async def _rec(pix):
    from winrt.windows.graphics.imaging import SoftwareBitmap, BitmapPixelFormat, BitmapAlphaMode
    from winrt.windows.storage.streams import DataWriter
    if pix.alpha == 0:
        pix = pymupdf.Pixmap(pix, 1)
    b = bytearray(pix.samples)
    b[0::4], b[2::4] = b[2::4], b[0::4]  # RGBA -> BGRA
    w = DataWriter(); w.write_bytes(bytes(b))
    sb = SoftwareBitmap.create_copy_from_buffer(w.detach_buffer(), BitmapPixelFormat.BGRA8,
                                                pix.width, pix.height, BitmapAlphaMode.PREMULTIPLIED)
    r = await _engine().recognize_async(sb)
    out = []
    for ln in r.lines:
        ws = list(ln.words)
        if not ws:
            continue
        x0 = min(w.bounding_rect.x for w in ws); y0 = min(w.bounding_rect.y for w in ws)
        x1 = max(w.bounding_rect.x + w.bounding_rect.width for w in ws)
        y1 = max(w.bounding_rect.y + w.bounding_rect.height for w in ws)
        out.append((ln.text, x0, y0, x1, y1))
    return out

OCR_TIMEOUTS = [0]
OCR_BUSY = [None]

def start_watchdog(limit=120):
    """a Windows OCR call can block the whole process; if one runs > limit s, log where and exit (driver retries)."""
    import threading, faulthandler
    def watch():
        while True:
            time.sleep(5)
            t = OCR_BUSY[0]
            if t and time.time() - t > limit:
                sys.stderr.write('WATCHDOG: OCR call blocked > %ds' % limit + chr(10))
                faulthandler.dump_traceback(file=sys.stderr, all_threads=True)
                sys.stderr.flush()
                os._exit(3)
    threading.Thread(target=watch, daemon=True).start()

def _MAXDIM():
    try:
        from winrt.windows.media.ocr import OcrEngine
        return int(OcrEngine.max_image_dimension) or 10000
    except Exception:
        return 10000

def _ocr_once(pix, lang):
    global _eng
    saved = OCR_LANG[0]; OCR_LANG[0] = lang
    try:
        _engine()
        for attempt in (1, 2):
            try:
                OCR_BUSY[0] = time.time()
                return asyncio.run(asyncio.wait_for(_rec(pix), 60))
            except (asyncio.TimeoutError, TimeoutError):
                _engs.pop(lang, None); _eng = None      # recreate the engine and retry once
            finally:
                OCR_BUSY[0] = None
        OCR_TIMEOUTS[0] += 1
        return []
    finally:
        OCR_LANG[0] = saved

def ocr_pix(pix):
    mx = _MAXDIM()
    if max(pix.width, pix.height) > mx:   # Windows OCR refuses images above this size: scale down
        f = (mx - 10) / max(pix.width, pix.height)
        pix = pymupdf.Pixmap(pix, int(pix.width * f), int(pix.height * f), None)
    if OCR_LANG[0] != 'hi':
        return _ocr_once(pix, 'en-US')
    # Hindi-medium paper: read with both engines; keep the Hindi reading when it is mostly Devanagari
    hi = _ocr_once(pix, 'hi')
    hi_txt = ''.join(t for t, *_r in hi).replace(' ', '')
    if hi_txt and len(re.findall(r'[ऀ-ॿ]', hi_txt)) >= 0.3 * len(hi_txt):
        return hi
    return _ocr_once(pix, 'en-US')

# ---------------------------------------------------------------- helpers
DEV = re.compile(r'[ऀ-ॿ]')
LAT = re.compile(r'[A-Za-z]')
DUP_MATRA = re.compile(r'([ँंा-ौ])\1+')

def norm(s):
    s = s.replace(' ', ' ')
    s = DUP_MATRA.sub(r'\1', s)  # text-layer artifact: doubled vowel signs (rendered once on the page)
    s = re.sub('([ँंा-ौ][ँंा-ौ])\\1+', r'\1', s)
    s = re.sub(r'[ \t]+', ' ', s)
    return s.strip()

def is_green_color(c):
    r, g, b = (c >> 16) & 255, (c >> 8) & 255, c & 255
    return g > 110 and g - r > 50 and g - b > 30

JUNK = [
    r'^Question\s*(ID|Id)?\s*[:.]?\s*\d*$', r'Question\s*I[Dd]\s*[:.]', r'^Option\s*\d\s*I[Dd]', r'^Status\s*[:.]',
    r'^Chosen\s*(Option)?', r'^Option\s*[:.]?\s*(\d|--)?$', r'^I[Dd]\s*[:.]?\s*\d*$', r'^\d{6,}$', r'^--$',
    r'^Status\s*:?\s*(Answered|Not Answered|Marked.*|Not Attempted.*)?$', r'^(Answered|Not Answered)$',
    r'^https?://', r'digialm\.com', r'googleusercontent', r'^\d{1,2}/\d{1,2}/\d{4},?\s*(\d{1,2}:\d{2}.*)?$',
    r'^\d{1,3}\s*/\s*\d{1,3}$', r'^Adda\s*24', r'GET IT ON', r'Google Play', r'^\(\s*\+\s*\d.*\)$',
    r'^Roll Number', r'^Candidate', r'^Name$', r'^Test Cent(er|re)', r'^Test Date', r'^Test Time', r'^Subject$',
    r'^\* ?Note', r'Correct Answer will carry', r'Incorrect Answer will carry', r'Options shown in green',
    r'Chosen option on the right', r'^Exam Date', r'^Exam Time', r'^Participant',
    r'^Venue Name', r'^Remark', r'^SubQuestion\s*No', r'^Sub\s*Question',
]
JUNK_RE = re.compile('|'.join(JUNK), re.I)

def junk(t):
    return bool(JUNK_RE.search(t))

# ---------------------------------------------------------------- page -> lines
HEADER_Y = 58   # Adda247 logo / Google Play strip

def _arr(pix):
    a = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.stride)[:, :pix.width * pix.n]
    return a.reshape(pix.height, pix.width, pix.n).astype(np.int16)

def green_count(gpix, zoom, x0, y0, x1, y1):
    """count green pixels in a rect (pt coords) of the colour render."""
    X0 = max(0, int(x0 * zoom)); Y0 = max(0, int(y0 * zoom))
    X1 = min(gpix.width, int(x1 * zoom)); Y1 = min(gpix.height, int(y1 * zoom))
    if X1 <= X0 or Y1 <= Y0:
        return 0
    a = _arr(gpix)[Y0:Y1, X0:X1]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return int(((g > 110) & (g - r > 50) & (g - b > 25)).sum())

def _red_green(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    red = (r > 170) & (g < 110) & (b < 110)
    grn = ~red & (g > 120) & (g - r > 50) & (g - b > 25)
    return red, grn

def icon_bands(pix, zoom, W):
    """horizontal bands holding a red (cross) or green (tick) icon in the option-icon column of a scanned page."""
    X0, X1 = int(55 * zoom), int(min(140, 0.3 * W) * zoom)
    red, grn = _red_green(_arr(pix)[:, X0:X1])
    prof = list(zip(red.sum(1).tolist(), grn.sum(1).tolist()))
    bands = []; cur = None
    for y, (rc, gc) in enumerate(prof):
        if rc + gc >= 2:
            if cur is None:
                cur = [y, y, 0, 0]
            cur[1] = y; cur[2] += rc; cur[3] += gc
        elif cur is not None and y - cur[1] > 2:
            bands.append(cur); cur = None
    if cur:
        bands.append(cur)
    out = []
    for y0, y1, rc, gc in bands:
        h = (y1 - y0) / zoom
        if 4 <= h <= 22 and rc + gc >= 25:
            out.append((y0 / zoom, y1 / zoom, gc > rc))
    return out

def icon_end(pix, zoom, y0, y1):
    """x (pt) where the tick/cross icon in this band ends."""
    a = _arr(pix)[int(y0 * zoom):int(y1 * zoom) + 1, int(50 * zoom):int(160 * zoom)]
    red, grn = _red_green(a)
    cols = (red | grn).any(axis=0).tolist()
    start = None
    for k, v in enumerate(cols):
        if v and start is None:
            start = k
        if start is not None and not any(cols[k:k + 4]):
            return (50 * zoom + k) / zoom
    return None

def ocr_row(page, rect, zoom=5):
    """OCR a single short row: binarise (coloured text -> black) and put a prefix word in front,
    because Windows OCR tends to drop isolated very short text."""
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=rect)
    a = _arr(pix)
    red, grn = _red_green(a)
    dark = (a[..., 0] + a[..., 1] + a[..., 2] < 450) | red | grn
    out = np.where(dark, 0, 255).astype(np.uint8).tobytes()
    gp = pymupdf.Pixmap(pymupdf.csGRAY, pix.width, pix.height, bytes(out), 0)
    doc = pymupdf.open(); h, w = gp.height, gp.width
    pw = 6 * h * 0.6 + 10
    pg = doc.new_page(width=w + pw + 40, height=h + 40)
    pg.insert_text((10, 20 + h * 0.72), 'Option', fontsize=h * 0.75, fontname='helv')
    pg.insert_image(pymupdf.Rect(pw, 20, pw + w, 20 + h), pixmap=gp)
    t = ' '.join(x for x, *_r in ocr_pix(pg.get_pixmap())).strip()
    t = re.sub(r'^[O0o]p?t?i?o?n\b\s*', '', t)
    return re.sub(r'^(?:[Xx×✗✘✕✓✔/|\']{1,2}\s*)?(?:[1-4Il|]\s*[.,:]\s*(?=\D|$))?', '', t).strip()

_ICON_CACHE = {}
def is_icon(page, im):
    """small image that is a red-cross / green-tick icon (mostly saturated red or green ink)."""
    key = (id(page.parent), im.get('xref'))
    if im.get('xref') and key in _ICON_CACHE:
        return _ICON_CACHE[key]
    a = _arr(page.get_pixmap(matrix=pymupdf.Matrix(3, 3), clip=pymupdf.Rect(im['bbox'])))
    red, grn = _red_green(a)
    ink = (a[..., 0] + a[..., 1] + a[..., 2]) < 600
    n_ink = int(ink.sum())
    res = n_ink > 0 and (int(red.sum()) + int(grn.sum())) >= 0.35 * n_ink
    if im.get('xref'):
        _ICON_CACHE[key] = res
    return res

def page_lines(doc, pno, issues):
    page = doc[pno]
    W, H = page.rect.width, page.rect.height
    lines = []
    d = page.get_text('dict')
    for b in d['blocks']:
        if b.get('type') != 0:
            continue
        for l in b['lines']:
            txt = ''.join(s['text'] for s in l['spans'])
            if not txt.strip():
                continue
            green = any(is_green_color(s['color']) for s in l['spans'] if s['text'].strip())
            x0, y0, x1, y1 = l['bbox']
            lines.append(dict(t=txt, x0=x0, y0=y0, x1=x1, y1=y1, green=green, src='text'))
    body = [l for l in lines if not junk(norm(l['t']))]
    body_chars = sum(len(l['t'].strip()) for l in body)
    method = 'text'
    if body_chars < 15:
        # raster page (scanned / printed-as-image) -> full page OCR
        imgs = page.get_image_info()
        big = [i for i in imgs if (i['bbox'][2] - i['bbox'][0]) * (i['bbox'][3] - i['bbox'][1]) > 0.25 * W * H]
        if not big and not imgs:
            return [], 'blank', None
        zoom = 3.0
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
        o = ocr_pix(pix)
        alltxt = ' '.join(t for (t, *_r) in o)
        if re.search(r'SUBSCRIPTION|ATTEMPT FREE MOCK|Mock Tests|Test Prime|Report Card', alltxt, re.I) and \
                not re.search(r'Question\s*I[Dd]|\bAns\b', alltxt):
            return [], 'advert', None
        lines = [dict(t=t, x0=a / zoom, y0=b_ / zoom, x1=c / zoom, y1=e / zoom, green=False, src='ocr-page')
                 for (t, a, b_, c, e) in o if a / zoom < 0.58 * W and e / zoom > max(48, 0.06 * H)]
        # option rows: find red-cross / green-tick icons in the left column, OCR each row on its own
        for (by0, by1, isgreen) in icon_bands(pix, zoom, W):
            removed = [l for l in lines if by0 - 3 <= (l['y0'] + l['y1']) / 2 <= by1 + 3 and l['x0'] < 0.58 * W]
            lines = [l for l in lines if l not in removed]
            xe = icon_end(pix, zoom, by0, by1) or 100
            lead = 'Ans ' if any(re.match(r'^Ans\b', l['t']) for l in removed) else ''
            txt = ' '.join(re.sub(r'^Ans\b\s*', '', l['t']) for l in sorted(removed, key=lambda l: l['x0'])).strip()
            txt = re.sub(r'^(?:[Xx×✗✘✕✓✔VvKkÄJ/|\\\'’]{1,2}\s*)?(?:[1-4Il|]\s*[.,:]\s*(?=\D|$))?', '', txt).strip()
            if not txt:   # page OCR missed the row: OCR the row alone (cleaned, with a prefix word)
                txt = ocr_row(page, pymupdf.Rect(xe + 1, by0 - 4, 0.58 * W, by1 + 4))
            letter = glyph.guess_letter(page, pymupdf.Rect(xe + 1, by0 - 3, min(xe + 60, 0.58 * W), by1 + 3))
            lines.append(dict(t=lead + (txt or '[IMAGE: no OCR text]'), x0=min([l['x0'] for l in removed] + [55]),
                              y0=by0, x1=0.58 * W, y1=by1, green=isgreen, src='ocr-page', optrow=True,
                              letter=letter, rect=(xe + 1, by0 - 4, 0.58 * W, by1 + 4)))
        method = 'ocr-page'
        gzoom = zoom
        gpix = pix
    else:
        # OCR embedded content images (question / option text rendered as images)
        imgs = page.get_image_info(xrefs=True)
        for im in imgs:
            x0, y0, x1, y1 = im['bbox']
            w, h = x1 - x0, y1 - y0
            if (y1 <= 56 and y0 < 20) or (y0 < 0.04 * H and y1 < 0.12 * H and (x1 < 0.3 * W or x0 > 0.6 * W)):   # logos (any page size)
                continue
            if w <= 26 and h <= 22 and is_icon(page, im):   # red cross / green tick answer icons
                continue
            if w * h > 0.45 * W * H or w < 4 or h < 4:           # ads / backgrounds / specks
                continue
            if y0 > H - 20:
                continue
            zoom = max(2.0, min(6.0, 60.0 / max(h, 1) if h < 30 else 3.0))
            try:
                pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=pymupdf.Rect(x0 - 2, y0 - 2, x1 + 2, y1 + 2))
                o = ocr_pix(pix)
            except Exception as e:
                issues.append(f'page {pno+1}: OCR failed on image at y={y0:.0f}: {e}')
                o = []
            if not o and w < 120 and h < 40:
                # very short text (e.g. "40") is often dropped by Windows OCR: retry with a prefix word
                t_short = ocr_row(page, pymupdf.Rect(x0 - 1, y0 - 1, x1 + 1, y1 + 1))
                if t_short:
                    o = [(t_short, 0, 0, (x1 - x0) * zoom, (y1 - y0) * zoom)]
            if not o:
                lines.append(dict(t='[IMAGE: no OCR text]', x0=x0, y0=y0, x1=x1, y1=y1, green=False, src='img-empty',
                                  img=dict(xref=im.get('xref', 0), bbox=(x0, y0, x1, y1), page=pno)))
            else:
                src = 'ocr-img'
                ts = [t for (t, *_r) in o]
                if (len(o) == 2 and all(re.fullmatch(r'[\w.+\-−√()²³ ]{1,14}', t) for t in ts)
                        and o[1][2] >= o[0][4] - 2 and o[0][1] < o[1][3] and o[1][1] < o[0][3]):
                    txt = ts[0] + '/' + ts[1]; src = 'ocr-img-frac'
                else:
                    txt = ' '.join(ts)
                lines.append(dict(t=txt, x0=x0, y0=y0, x1=x1, y1=y1, green=False, src=src,
                                  img=dict(xref=im.get('xref', 0), bbox=(x0, y0, x1, y1), page=pno)))
            method = 'text+ocr'
        gzoom = 1.5
        gpix = page.get_pixmap(matrix=pymupdf.Matrix(gzoom, gzoom))
    for l in lines:
        l['page'] = pno + 1
    return lines, method, (gpix, gzoom)

def rows_from_lines(lines, gp):
    """filter junk, group lines into visual rows, compute green flags."""
    keep = []
    for l in lines:
        t = norm(l['t'])
        if not t or (junk(t) and not l.get('img')):
            continue
        l['t'] = t
        keep.append(l)
    keep.sort(key=lambda l: ((l['y0'] + l['y1']) / 2, l['x0']))
    rows = []
    for l in keep:
        h = l['y1'] - l['y0']
        if rows:
            r = rows[-1]
            rh = r['y1'] - r['y0']
            ov = min(r['y1'], l['y1']) - max(r['y0'], l['y0'])
            if ov > 0.5 * min(h, rh):
                r['parts'].append(l); r['y0'] = min(r['y0'], l['y0']); r['y1'] = max(r['y1'], l['y1'])
                continue
        rows.append(dict(parts=[l], y0=l['y0'], y1=l['y1'], page=l['page']))
    out = []
    gpix, gz = gp if gp else (None, 1)
    for r in rows:
        ps = sorted(r['parts'], key=lambda p: p['x0'])
        txt = ' '.join(p['t'] for p in ps)
        x0 = ps[0]['x0']; x1 = max(p['x1'] for p in ps)
        green_txt = any(p['green'] for p in ps)
        gcount = green_count(gpix, gz, x0 - 34, r['y0'], min(x0 + 60, x1), r['y1']) if gpix else 0
        out.append(dict(t=txt, x0=x0, x1=x1, y0=r['y0'], y1=r['y1'], page=r['page'],
                        green=green_txt or gcount >= 6 * (gz / 1.5) ** 2, src={p['src'] for p in ps},
                        imgs=[p['img'] for p in ps if p.get('img')], optrow=any(p.get('optrow') for p in ps),
                        letter=next((p['letter'] for p in ps if p.get('letter')), None)))
    return out

# ---------------------------------------------------------------- parsing
Q_RE = re.compile(r'^Q\s*\.?\s*(\d{1,3})\s*[.:)]?(?:\s+|$)(.*)$')
Q_OCR_RE = re.compile(r'^[QO0]\s*[.,:•·]?\s*([0-9IlOoS|]{1,3})\s*[.:)]?(?:\s+|$)(.*)$')
OCR_DIGITS = str.maketrans('IlOoS|', '110051')
ANS_RE = re.compile(r'^Ans(?:wer)?\b\s*[:.]?\s*(.*)$')
OPT_RE_NUM = re.compile(r'^(?:[Xx×✗✘✕Vv✓✔J/\\]{1,2}\s*)?([1-4])\s*[.,)]\s*(.*)$')
OPT_RE_LET = re.compile(r'^(?:[Xx×✗✘✕Vv✓✔J/\\]{1,2}\s*)?([A-D])\s*[.)]\s*(.*)$')
class _OptMatch:
    def __init__(self, n, rest): self._g = (str(n), rest)
    def group(self, i): return self._g[i - 1]
class OPT_RE:
    @staticmethod
    def match(t):
        m = OPT_RE_NUM.match(t)
        if m:
            return m
        m = OPT_RE_LET.match(t)
        return _OptMatch('ABCD'.index(m.group(1)) + 1, m.group(2)) if m else None
NUMQ_RE = re.compile(r'^(\d{1,3})\.\s+(\S.*)$')
LETTER_OPT_RE = re.compile(r'^([A-D])\s*[.)]\s*(.*)$')
LETTER_MAP_RE = re.compile(r'^[a-d]\s*[.)]\s*[A-D]$')
ANSKEY_RE = re.compile(r'^(\d{1,3})\s*[.)]\s*Answer\s*[:.-]', re.I)
COMPREH_RE = re.compile(r'^(Comprehension|Directions?|निर्देश|गद्यांश)\b', re.I)

def parse_rows(rows, numbered):
    qs = []; cur = None; mode = None; pre = []; section = ''; anskey = []; preimgs = []; pre_regions = []
    def close():
        nonlocal cur
        if cur:
            qs.append(cur)
        cur = None
    for r in rows:
        t = r['t']
        ms = re.match(r'^Section\s*:\s*(.+)$', t, re.I)
        if ms:
            section = ms.group(1).strip(); continue
        is_ocr = 'ocr-page' in r['src']
        if numbered and (anskey or ANSKEY_RE.match(t)):
            anskey.append(t); continue
        m = Q_RE.match(t) or (Q_OCR_RE.match(t) if is_ocr else None)
        if numbered and not m:
            m2 = NUMQ_RE.match(t)
            if m2 and r['x0'] < 90 and (cur is None or mode in ('opts', 'map') or len(cur['letters']) >= 4):
                m = m2
        if m:
            close()
            cur = dict(num=int(m.group(1).translate(OCR_DIGITS)), numocr=m.group(1), page=r['page'], q=[m.group(2)] if m.group(2) else [], opts=[], green=[],
                       letters=[], map={}, passage=pre, section=section, src=set(r['src']), last=r,
                       qimgs=list(r['imgs']), oimgs=[], limgs=[], pimgs=preimgs, regions=[(r['page'], r['y0'], r['y1'])])
            pre = []; preimgs = []; pre_regions = []; mode = 'q'
            continue
        if cur is None:
            if COMPREH_RE.match(t) or pre:
                pre.append(t); preimgs.extend(r['imgs'])
            continue
        if is_ocr and len(cur['opts']) >= 4 and (r.get('optrow') or ANS_RE.match(t)) and pre:
            # OCR missed the "Q.N" heading: the text after the last option is a new question
            prev = cur['num']; close()
            cur = dict(num=prev + 1, numocr='(heading not read)', unlabelled=True, page=r['page'], q=list(pre),
                       opts=[], green=[], letters=[], map={}, passage=[], section=section, src=set(r['src']), last=r,
                       qimgs=list(preimgs), oimgs=[], limgs=[], pimgs=[], regions=list(pre_regions))
            pre = []; preimgs = []; pre_regions = []; mode = 'q'
        cur['src'] |= r['src']
        cur['regions'].append((r['page'], r['y0'], r['y1']))
        ma = ANS_RE.match(t)
        if ma and not numbered:
            mode = 'opts'
            t = ma.group(1).strip()
            if not t:
                cur['last'] = r; continue
            if not is_ocr and not OPT_RE.match(t) and not cur['opts']:
                # option-1 image sits on the same visual row as "Ans" (label "1." is slightly lower)
                cur['pend'] = (t, list(r['imgs'])); cur['last'] = r; continue
        if numbered:
            ml = LETTER_OPT_RE.match(t)
            if ml and mode in ('q', 'letters'):
                cur['letters'].append([ml.group(1), ml.group(2)]); cur['limgs'].append(list(r['imgs'])); mode = 'letters'; cur['last'] = r; continue
            if LETTER_MAP_RE.match(t):
                cur['map'][t[0]] = t[-1]
                mode = 'map'; cur['last'] = r; continue
        if r.get('optrow') and mode in ('opts', 'q'):
            # icon-detected option row on a scanned page (strip the OCR'd icon/label prefix)
            mode = 'opts'
            mm = re.match(r'^(?:[Xx×✗✘✕✓✔VvKkÄJ/|\\]{1,2}\s*)?[1-4Il|]\s*[.,:]\s*(?=\D|$)(.*)$', t)
            t2 = mm.group(1) if mm else re.sub(r'^[Xx×✗✘✕✓✔Ä]\s+', '', t)
            cur['opts'].append(t2.strip()); cur['green'].append(bool(r['green'])); cur['oimgs'].append([]); cur['last'] = r
            cur.setdefault('oletters', {})[len(cur['opts']) - 1] = r.get('letter')
            continue
        if mode == 'opts':
            mo = OPT_RE.match(t)
            if mo and int(mo.group(1)) == len(cur['opts']) + 1:
                otext, oim = mo.group(2), list(r['imgs'])
                if not cur['opts'] and cur.get('pend'):
                    otext = (cur['pend'][0] + ' ' + otext).strip(); oim = cur['pend'][1] + oim; cur['pend'] = None
                cur['opts'].append(otext); cur['green'].append(bool(r['green'])); cur['oimgs'].append(oim); cur['last'] = r
                continue
            if is_ocr and len(cur['opts']) < 4 and not COMPREH_RE.match(t):
                # OCR often loses the small "1."-"4." labels: treat each separate row as the next option
                last = cur['last']
                gap = r['y0'] - last['y1'] if r['page'] == last['page'] else 999
                exp = len(cur['opts']) + 1
                ml2 = re.match(r'^([Xx×✗✓✔VvKkÄ/|]\s*)?([1-4Il|])\s*([.,])?\s+(.*)$', t)
                labelled = bool(ml2 and (ml2.group(1) or ml2.group(3) or exp >= 2)
                                and int(ml2.group(2).translate(OCR_DIGITS)) == exp)
                t2 = ml2.group(4) if labelled else re.sub(r'^[Xx×✗✓✔]\s+', '', t)
                if not cur['opts'] or gap > 1.5 or labelled:
                    cur['opts'].append(t2); cur['green'].append(bool(r['green'])); cur['oimgs'].append(list(r['imgs'])); cur['last'] = r
                    continue
            if COMPREH_RE.match(t):
                pre.append(t); preimgs.extend(r['imgs']); pre_regions.append(cur['regions'].pop()); mode = 'pre'; continue
            last = cur['last']
            gap = r['y0'] - last['y1'] if r['page'] == last['page'] else 999
            if cur['opts'] and (len(cur['opts']) < 4 or (gap < 8 and r['x0'] > 70)):
                cur['opts'][-1] += ' ' + t
                cur['oimgs'][-1].extend(r['imgs'])
                if r['green']:
                    cur['green'][-1] = True
                cur['last'] = r
            else:
                pre.append(t); preimgs.extend(r['imgs']); pre_regions.append(cur['regions'].pop()); mode = 'pre'
            continue
        if mode == 'pre':
            pre.append(t); preimgs.extend(r['imgs']); pre_regions.append(cur['regions'].pop()); continue
        if mode == 'letters':
            cur['letters'][-1][1] += ' ' + t; cur['limgs'][-1].extend(r['imgs']); cur['last'] = r; continue
        if mode == 'map':
            continue
        cur['q'].append(t); cur['qimgs'].extend(r['imgs']); cur['last'] = r
    close()
    return qs, pre, anskey

# ---------------------------------------------------------------- per file

MONTHS = {m: i for i, m in enumerate(['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'], 1)}
def file_meta(fname, p1, alltext, file_hi, is_resp):
    f = fname.replace('–', '-')
    md = {}
    # date: prefer the PDF header (Test Date / Exam Date), else filename
    dt = None
    m = re.search(r'(?:Test|Exam)\s*Date\s*:?\s*(\d{1,2})/(\d{1,2})/(\d{4})', p1)
    if m: dt = (int(m.group(3)), int(m.group(2)), int(m.group(1))); md['dateSource'] = 'pdf'
    if not dt:
        m = re.search(r'(?<!\d)(\d{1,2})(?:st|nd|rd|th)?[-_. ]([A-Za-z]{3})[a-z]*[-_. ](20\d\d)', f)
        if m and m.group(2).lower()[:3] in MONTHS:
            dt = (int(m.group(3)), MONTHS[m.group(2).lower()[:3]], int(m.group(1)))
        else:
            m = re.search(r'(?<!\d)(\d{1,2})[-.](\d{1,2})[-.](20\d\d)', f)
            if m: dt = (int(m.group(3)), int(m.group(2)), int(m.group(1)))
        if dt: md['dateSource'] = 'filename'
    md['examDate'] = f'{dt[0]:04d}-{dt[1]:02d}-{dt[2]:02d}' if dt else ''
    md['examYear'] = dt[0] if dt else None
    m = re.search(r'(?:Test|Exam)\s*Time\s*:?\s*(\d{1,2}:\d{2}\s*[AP]M\s*-\s*\d{1,2}:\d{2}\s*[AP]M)', p1)
    if m: md['examTime'] = m.group(1)
    else:
        m = re.search(r'(\d{1,2}[.:]\d{2})(?:-?\s*(am|pm))?-(?:to-)?(\d{1,2}(?:[.:]\d{2})?)(?:-?(am|pm))?', f, re.I)
        md['examTime'] = (m.group(0).replace('-to-', '-')) if m else ''
    m = re.search(r'(?:Shift[-_ ]?|[-_ ]S)(\d|III|II|I)(?![a-zA-Z\d])', f)
    roman = {'I': 1, 'II': 2, 'III': 3}
    md['shift'] = (int(m.group(1)) if m.group(1).isdigit() else roman[m.group(1)]) if m else None
    m = re.search(r'Subject\s*:?\s*\n?\s*([^\n]+)', p1)
    md['subject'] = m.group(1).strip() if m else ''
    lv = ''
    if re.search(r'Graduate|_G_|GRADE-I', f, re.I) and not re.search(r'Under', f, re.I): lv = 'Graduate'
    if re.search(r'(?<![A-Za-z])UG(?![A-Za-z])|Under\s*Graduate', f, re.I): lv = 'Undergraduate'
    if not lv and re.search(r'Under\s*Graduate', md['subject'], re.I): lv = 'Undergraduate'
    if not lv and re.search(r'Graduate', md['subject'], re.I): lv = 'Graduate'
    md['examLevel'] = lv
    m = re.search(r'Level\s*(\d)', md['subject'])
    md['payLevel'] = int(m.group(1)) if m else None
    tags = exam_tags(fname, p1)
    md['examStage'] = tags[0] if tags and tags[0].startswith('CBT') else ''
    m = re.search(r'(?:NTPC[-_ ](?:CBT[-_ ]?\d[-_ ])?|Graduate[-_ ])((?:19|20)\d\d)(?=[-_ ])', f)
    md['recruitmentYear'] = int(m.group(1)) if m else None
    if is_resp: dtype = 'Candidate response sheet (digialm) with answer marking'
    elif re.search(r'Answer[-_ ]Key', f, re.I): dtype = 'Answer key'
    elif re.search(r'Compilation', f, re.I): dtype = 'Paper compilation'
    else: dtype = 'Question paper'
    md['documentType'] = dtype
    if re.search(r'Hindi', f, re.I): pl = 'Hindi'
    elif re.search(r'Eng', f, re.I): pl = 'English'
    else: pl = 'Hindi' if file_hi else 'English'
    md['paperLanguage'] = pl
    md['publisherWatermark'] = 'Adda247' if 'adda' in alltext.lower() or 'Adda' in f else ''
    md['examName'] = 'RRB NTPC'
    return md
def exam_tags(fname, firsttext):
    s = fname + ' ' + firsttext
    tags = []
    if re.search(r'CBT[\s_-]*(0?1|I)(?![I\d])', s, re.I):
        tags.append('CBT-1')
    if re.search(r'CBT[\s_-]*(0?2|II)(?![I\d])', s, re.I):
        tags.append('CBT-2')
    if re.search(r'Station\s*Master', s, re.I):
        tags.append('Station Master')
    return tags

IMG_ROOT = os.environ.get('IMG_ROOT', '')       # folder that will contain question_images/
IMG_REL = 'question_images'

def safe_stem(fname):
    st = os.path.splitext(fname)[0].replace('–', '-')
    return re.sub(r'[^A-Za-z0-9._-]+', '_', st).strip('_')

class ImgSaver:
    def __init__(self, doc, fname):
        self.doc = doc; self.stem = safe_stem(fname); self.cache = {}; self.n = 0; self.bytes = 0
        self.dir = os.path.join(IMG_ROOT, IMG_REL, self.stem)
    def _write(self, pix, name):
        os.makedirs(self.dir, exist_ok=True)
        fp = os.path.join(self.dir, name)
        pix.save(fp); self.n += 1; self.bytes += os.path.getsize(fp)
        return f'{IMG_REL}/{self.stem}/{name}'
    def embedded(self, img, name):
        key = img['xref'] if img['xref'] else (img['page'], tuple(round(v) for v in img['bbox']))
        if key in self.cache:
            return self.cache[key]
        pix = None
        try:
            if img['xref']:
                pix = pymupdf.Pixmap(self.doc, img['xref'])
                sm = self.doc.xref_get_key(img['xref'], 'SMask')
                if sm[0] == 'xref':
                    pix = pymupdf.Pixmap(pix, pymupdf.Pixmap(self.doc, int(sm[1].split()[0])))
                if pix.colorspace and pix.colorspace.n not in (1, 3):
                    pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
                if pix.width < 2 or pix.height < 2:
                    pix = None
        except Exception:
            pix = None
        if pix is None:   # inline image / unusual encoding -> render that area of the page
            x0, y0, x1, y1 = img['bbox']
            pix = self.doc[img['page']].get_pixmap(matrix=pymupdf.Matrix(3, 3), clip=pymupdf.Rect(x0, y0, x1, y1))
        try:
            if pix.colorspace is None or pix.colorspace.n not in (1, 3):
                pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
            path = self._write(pix, name)
        except Exception:   # unusual pixel format (e.g. CMYK+alpha, indexed): render that page area instead
            x0, y0, x1, y1 = img['bbox']
            pix = self.doc[img['page']].get_pixmap(matrix=pymupdf.Matrix(3, 3), clip=pymupdf.Rect(x0, y0, x1, y1))
            path = self._write(pix, name)
        self.cache[key] = path
        return path
    def crop(self, regions, name):
        """crop of a question's area on scanned pages (one image per page it spans)."""
        out = []; bypage = {}
        for pg, y0, y1 in regions:
            a = bypage.setdefault(pg, [y0, y1]); a[0] = min(a[0], y0); a[1] = max(a[1], y1)
        for pg, (y0, y1) in sorted(bypage.items()):
            page = self.doc[pg - 1]
            r = pymupdf.Rect(0, max(0, y0 - 6), page.rect.width, min(page.rect.height, y1 + 6))
            if r.height < 4:
                continue
            pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=r)
            out.append(self._write(pix, f'{name}_p{pg}.png' if len(bypage) > 1 else f'{name}.png'))
        return out

def process(path):
    fname = os.path.basename(path)
    issues = []; records = []; pages_info = []
    doc = pymupdf.open(path)
    alltext = ''.join(p.get_text() for p in doc)
    numbered = not re.search(r'^Q\s*\.\s*\d', alltext, re.M) and len(alltext) > 5000
    file_hi = len(DEV.findall(alltext)) > len(LAT.findall(alltext)) * 0.5
    OCR_LANG[0] = 'en-US'
    hindi_img = False; hindi_ocr = False
    if not file_hi and len(DEV.findall(alltext)) < 50:
        hindi_img, pn, ptoks, pratio = probe_hindi_images(doc)
        if hindi_img:
            issues.append(f'Hindi-medium paper: question text is printed as Devanagari images '
                          f'(probe: {pn} images, {ptoks} English tokens, common-word ratio {pratio:.2f})')
            if hindi_ocr_available():
                OCR_LANG[0] = 'hi'; hindi_ocr = True
                issues.append('Hindi OCR (Windows) used for this paper')
            else:
                issues.append('Windows Hindi OCR not installed: Devanagari image text left blank; images saved')
    rows = []
    for pno in range(doc.page_count):
        try:
            lines, method, gp = page_lines(doc, pno, issues)
        except Exception as e:
            issues.append(f'page {pno+1}: extraction error {e!r}')
            pages_info.append([pno + 1, 'error', 0]); continue
        prow = rows_from_lines(lines, gp) if lines else []
        pages_info.append([pno + 1, method, len(prow)])
        rows.extend(prow)
    p1rows = ' '.join(r['t'] for r in rows if r['page'] == 1)
    qs, trailing, anskey = parse_rows(rows, numbered)
    answers = {}
    if anskey:
        blob = ' '.join(anskey)
        parts = re.split(r'(?:^|\s)(\d{1,3})\s*[.)]\s*Answer\s*[:.-]\s*\(?([a-dA-D])\)?\s*', blob)
        for i in range(1, len(parts) - 2, 3):
            expl = re.sub(r'^Explanation\s*[:.-]\s*', '', parts[i + 2].strip())
            answers.setdefault(int(parts[i]), (parts[i + 1], expl))
    p1 = doc[0].get_text()[:4000]
    tags = exam_tags(fname, p1)
    fmeta = file_meta(fname, p1, alltext, file_hi, 'Question ID' in alltext and 'Chosen Option' in alltext)
    m = re.search(r'CEN\s*[-–]?\s*(?:No\.?\s*)?(\d{2})\s*/\s*(\d{4})', p1 + ' ' + p1rows)
    fmeta['cenNumber'] = f'CEN {m.group(1)}/{m.group(2)}' if m else ''
    if fmeta['recruitmentYear'] is None and m:
        fmeta['recruitmentYear'] = int(m.group(2))
    # OCR'd question numbers: repair obvious misreads using the neighbours' sequence
    for i, q in enumerate(qs):
        q['numfix'] = False
        if 'ocr-page' in q['src'] and 0 < i < len(qs) - 1:
            a, b = qs[i - 1]['num'], qs[i + 1]['num']
            if q['num'] != a + 1 and b == a + 2:
                q['num'] = a + 1; q['numfix'] = True
    saver = ImgSaver(doc, fname) if IMG_ROOT else None
    for qi, q in enumerate(qs):
        flags = []
        qtext = ' '.join(q['q']).strip()
        opts = [o.strip() for o in q['opts']]
        green = q['green']
        correct = ''
        explanation = ''
        if numbered or (q['letters'] and len(q['letters']) >= 2):
            letters = q['letters']
            opts = [b.strip() for a, b in letters]
            q['oimgs'] = q['limgs']
            green = [False] * len(opts)
            ak = answers.get(q['num'])
            if ak:
                choice, explanation = ak[0].lower(), ak[1]
                letter = q['map'].get(choice) if q['map'] else choice.upper()
                idx = 'ABCD'.find(letter) if letter else -1
                if 0 <= idx < len(opts):
                    green[idx] = True
                    if not q['map']:
                        flags.append('answer letter applied directly to A-D (no a-d mapping rows)')
                else:
                    flags.append(f'answer key choice {choice!r} could not be mapped to an option')
            else:
                flags.append('no answer key entry for this question')
        # answer rows that are a letter mapping (e.g. "3. B"); options A-D are then inside the question text
        oletters = q.get('oletters', {})
        maplet = []; guessed = False
        for i, o in enumerate(opts):
            m = re.match(r'^([A-Da-d])(?:\s|$)', o.strip())
            short = len(re.sub(r'\W', '', o)) <= 3 or o.startswith('[IMAGE')
            if oletters.get(i) and oletters[i][1] >= 0.85 and short:
                maplet.append(oletters[i][0]); guessed = True
            elif m and len(o.strip()) <= 2:
                maplet.append(m.group(1).upper())
            elif m and re.match(r'^[A-D]\s+(Note|नोट)', o.strip()):
                maplet.append(m.group(1))
            elif oletters.get(i) and oletters[i][1] >= 0.85 and len(re.sub(r'\W', '', o)) <= 3:
                maplet.append(oletters[i][0]); guessed = True
            else:
                maplet.append(None)
        mlet = re.match(r'^(.*?)\s*(?:^|\s)A\s*[.)\-:]?\s+(.+?)\s+B\s*[.)\-:]?\s+(.+?)\s+[Cc]\s*[.)\-:]?\s+(.+?)\s+D\s*[.)\-:]?\s+(.+)$', qtext)
        mlet2 = re.match(r'^(.*)\sA\s*[.)\-:]?\s+(.+?)\s+B\s*[.)\-:]?\s+(.+?)\s+[Cc]\s*[.)\-:]?\s+(.+?)\s+D\s*[.)\-:]?\s+(.+)$', qtext)
        mlet = mlet2 or mlet
        lettered = dict(zip('ABCD', mlet.groups()[1:])) if mlet else {}
        lettered_q = [mlet.group(1)] if mlet else [qtext]
        if (not numbered and not q['letters'] and len(opts) == 4 and None not in maplet
                and sorted(maplet) == list('ABCD') and all(k in lettered for k in 'ABCD')):
            note = ' '.join(re.sub(r'^[A-D]\s*', '', o.strip()) for o in opts if len(o.strip()) > 2).strip()
            gl = [maplet[i] for i, g in enumerate(green) if g]
            qtext = lettered_q[0].strip(); opts = [lettered[k].strip() for k in 'ABCD']
            green = [k in gl for k in 'ABCD']
            flags.append('options A-D split from question body; answer rows were a letter mapping'
                         + (' (letters read by glyph matching)' if guessed else ''))
            if note:
                q['note'] = note
        elif (not numbered and not q['letters'] and len(opts) == 4 and None not in maplet
                and sorted(maplet) == list('ABCD')):
            # answer rows are "1. C", "2. A" ... but the A-D option texts could not be read from the image
            opts = maplet
            flags.append('options are the answer-row letters as printed (e.g. "1. C"); the A-D option texts are '
                         'inside the question image - see questionImages')
        elif not numbered and not q['letters'] and len(opts) == 4 and sum(x is not None for x in maplet) >= 2 \
                and lettered:
            flags.append('answer rows look like a letter mapping but could not be resolved')
        ng = sum(green)
        if len(green) == len(opts) and ng == 1:
            correct = opts[green.index(True)]
        elif ng > 1:
            flags.append(f'{ng} options marked correct; answer left blank')
        elif not numbered:
            flags.append('correct answer not identifiable')
        if numbered and q['map']:
            rec_map = q['map']
        if len(opts) != 4:
            flags.append(f'{len(opts)} options found (expected 4)')
        if not qtext:
            flags.append('empty question text')
        if any(not o for o in opts):
            flags.append('empty option text (likely image/formula not OCR-readable)')
        src = q['src']
        if 'ocr-page' in src:
            method = 'ocr'; flags.append('OCR of scanned page - verify text')
        elif any(x.startswith('ocr-img') or x == 'img-empty' for x in src):
            method = 'text+ocr'; flags.append('contains OCR of embedded image - verify text')
        else:
            method = 'text'
        if q.get('unlabelled'):
            flags.append('"Q.N" heading not readable by OCR; question number inferred from sequence')
        if q.get('numfix'):
            flags.append(f"question number inferred from sequence (OCR read {q['numocr']!r})")
        if 'ocr-img-frac' in src:
            flags.append('stacked image text joined as a/b (fraction)')
        if '[IMAGE: no OCR text]' in qtext + ''.join(opts):
            flags.append('image with no OCR-readable text (diagram/formula)')
        passage = ' '.join(q['passage']).strip()
        qimg_paths = []; oimg_paths = [[] for _ in opts]; pimg_paths = []
        if saver:
            base = f"r{qi + 1:03d}_q{q['num']:03d}"
            try:
                if 'ocr-page' in src:
                    qimg_paths = saver.crop(q['regions'], f'{base}_scan')
                for k, im in enumerate(q['qimgs'], 1):
                    qimg_paths.append(saver.embedded(im, f'{base}_question_{k}.png'))
                for j, ims in enumerate(q['oimgs'][:len(opts)]):
                    for k, im in enumerate(ims, 1):
                        oimg_paths[j].append(saver.embedded(im, f'{base}_opt{j + 1}_{k}.png'))
                for j in range(len(opts), len(q['oimgs'])):
                    for k, im in enumerate(q['oimgs'][j], 1):
                        qimg_paths.append(saver.embedded(im, f'{base}_extra{j + 1}_{k}.png'))
                for k, im in enumerate(q['pimgs'], 1):
                    pimg_paths.append(saver.embedded(im, f'{base}_passage_{k}.png'))
            except Exception as e:
                flags.append(f'image save failed: {e}')
        if 'ocr-page' in src:
            flags.append('scanned question saved as image crop (questionImages)')
        blob = qtext + ' ' + ' '.join(opts)
        hi = bool(DEV.search(blob)) or (file_hi and not LAT.search(blob))
        ocr_raw = ''
        if hindi_img and method != 'text':
            hi = True
            if not hindi_ocr:
                # English OCR of Devanagari is garbage: keep only option texts that are numbers/symbols
                ocr_raw = (qtext + ' || ' + ' | '.join(opts)).strip()
                qtext = ''
                opts = [o if re.fullmatch(r'[\d\s.,:;/%₹()+\-−×÷=<>°^]+', o or '') else '' for o in opts]
                correct = opts[green.index(True)] if (ng == 1 and len(green) == len(opts)) else ''
                flags.append('Hindi text printed as image could not be OCR-read (English-only OCR); '
                             'see questionImages/optionImages')
            else:
                flags.append('Hindi OCR of image text - verify')
        if hi and 'ocr' in method and DEV.search(blob) is None and not hindi_img:
            flags.append('Hindi paper: image content OCR (English-only OCR engine)')
        rec = {
            'examTag': tags,
            'question': '' if hi else qtext, 'options': [] if hi else opts,
            'correctAnswer': '' if hi else correct, 'explanation': '' if hi else explanation,
            'questionHi': qtext if hi else '', 'optionsHi': opts if hi else [],
            'correctAnswerHi': correct if hi else '', 'explanationHi': explanation if hi else '',
            'sourceFile': fname, 'pageNumber': q['page'], 'questionNumber': q['num'],
            'validation': 'ok' if not flags else 'review: ' + '; '.join(flags),
            'language': 'hi' if hi else 'en',
            'correctOptionNumber': (green.index(True) + 1) if (ng == 1 and len(green) == len(opts)) else None,
            'passage': passage,
            'extractionMethod': method,
            'section': q['section'],
            'sourceFilePath': path,
            'sourceTotalPages': doc.page_count,
            'hasImage': bool(qimg_paths or any(oimg_paths) or pimg_paths),
            'questionImages': qimg_paths,
            'optionImages': oimg_paths if any(oimg_paths) else [],
            'passageImages': pimg_paths,
            'sourceNote': q.get('note', ''),
            'ocrRawText': ocr_raw,
        }
        rec.update({k: v for k, v in fmeta.items() if k != 'dateSource'})
        rec['examDateSource'] = fmeta.get('dateSource', '')
        records.append(rec)
    if trailing:
        issues.append(f'{len(trailing)} unattached rows after last question (e.g. {trailing[0][:80]!r})')
    if OCR_TIMEOUTS[0]:
        issues.append(f'{OCR_TIMEOUTS[0]} OCR calls timed out (text for those images/pages is missing)')
    return dict(file=fname, pages=doc.page_count, page_methods=pages_info, numbered=numbered,
                hindi=file_hi, meta=fmeta, records=records, issues=issues,
                images_saved=saver.n if saver else 0, image_bytes=saver.bytes if saver else 0)

def run_one(args):
    path, outdir = args
    out = os.path.join(outdir, os.path.basename(path) + '.json')
    if os.path.exists(out):
        return out
    try:
        res = process(path)
    except Exception:
        res = dict(file=os.path.basename(path), fatal=traceback.format_exc(), records=[], issues=[])
    with open(out + '.tmp', 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False)
    os.replace(out + '.tmp', out)   # atomic: an interrupted run never leaves a half-written result
    return out

def driver(src, outdir, files, nproc, timeout):
    """run each PDF in its own subprocess (with a time limit) so one stuck file cannot block the run."""
    import subprocess, time
    from concurrent.futures import ThreadPoolExecutor
    log = open(os.path.join(os.path.dirname(os.path.abspath(outdir)), 'run.log'), 'a', encoding='utf-8')
    def lg(msg):
        log.write(time.strftime('%H:%M:%S ') + msg + chr(10)); log.flush()
    todo = [f for f in files if not os.path.exists(os.path.join(outdir, f + '.json'))]
    lg(f'start: {len(todo)} files to do, {nproc} parallel, timeout {timeout}s')
    def one(f):
        t0 = time.time(); lg('BEGIN ' + f)
        try:
            for attempt in (1, 2):
                r = subprocess.run([sys.executable, '-P', os.path.abspath(__file__), src, outdir, f],
                                   capture_output=True, text=True, timeout=timeout)
                if r.returncode == 0 and os.path.exists(os.path.join(outdir, f + '.json')):
                    break
                lg(f'RETRY {f} (attempt {attempt} exit {r.returncode}): {r.stderr[-400:]!r}')
            else:
                raise RuntimeError(f'exit {r.returncode}: {r.stderr[-500:]}')
            lg(f'END   {f} ({time.time() - t0:.0f}s)')
        except Exception as e:
            kind = 'TIMEOUT' if isinstance(e, subprocess.TimeoutExpired) else 'ERROR'
            lg(f'{kind} {f}: {str(e)[:300]}')
            res = dict(file=f, fatal=f'{kind}: {e}', records=[], issues=[])
            with open(os.path.join(outdir, f + '.json'), 'w', encoding='utf-8') as fh:
                json.dump(res, fh, ensure_ascii=False)
    with ThreadPoolExecutor(nproc) as ex:
        list(ex.map(one, todo))
    lg('all done')

if __name__ == '__main__':
    src, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    files = sys.argv[3:]
    if len(files) == 1:
        start_watchdog(40)
        run_one((os.path.join(src, files[0]), outdir))
    else:
        files = files or sorted(f for f in os.listdir(src) if f.lower().endswith('.pdf'))
        driver(src, outdir, files, int(os.environ.get('NPROC', '6')), int(os.environ.get('FILE_TIMEOUT', '1200')))
