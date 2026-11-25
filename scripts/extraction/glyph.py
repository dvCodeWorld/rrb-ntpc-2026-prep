"""Identify an isolated capital letter A-D (answer-mapping rows like '3. B') by template matching."""
import pymupdf
import numpy as np
GW, GH = 14, 18

def _bin(pix):
    a = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.stride)[:, :pix.width * pix.n]
    a = a.reshape(pix.height, pix.width, pix.n).astype(np.int16)
    r, gg, b = a[..., 0], a[..., 1], a[..., 2]
    m = (r + gg + b < 450) | ((r > 170) & (gg < 110) & (b < 110)) | ((gg > 120) & (gg - r > 50))
    return m.tolist()

def _norm(bits, x0, x1):
    ys = [y for y in range(len(bits)) if any(bits[y][x0:x1])]
    if not ys:
        return None
    y0, y1 = ys[0], ys[-1] + 1
    h, w = y1 - y0, x1 - x0
    if h < 5 or w < 3:
        return None
    return tuple(bits[y0 + (gy * h) // GH][x0 + (gx * w) // GW] for gy in range(GH) for gx in range(GW))

def _segments(bits):
    W = len(bits[0]); cols = [any(r[x] for r in bits) for x in range(W)]
    segs = []; s = None
    for x, c in enumerate(cols + [False]):
        if c and s is None: s = x
        if not c and s is not None: segs.append((s, x)); s = None
    return segs

_T = None
def templates():
    global _T
    if _T is None:
        _T = {}
        for font in ('helv', 'tiro'):
            for L in 'ABCD':
                doc = pymupdf.open(); pg = doc.new_page(width=60, height=60)
                pg.insert_text((10, 45), L, fontsize=40, fontname=font)
                bits = _bin(pg.get_pixmap())
                sg = _segments(bits)
                _T.setdefault(L, []).append(_norm(bits, sg[0][0], sg[-1][1]))
    return _T

def guess_letter(page, rect, zoom=5):
    """return (letter, score) for the right-most glyph inside rect, or (None, 0)."""
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=rect)
    bits = _bin(pix)
    segs = [s for s in _segments(bits) if s[1] - s[0] >= 2]
    if not segs:
        return None, 0.0
    g = _norm(bits, *segs[-1])
    if g is None:
        return None, 0.0
    best = (None, 0.0)
    for L, ts in templates().items():
        for t in ts:
            sc = sum(a == b for a, b in zip(g, t)) / len(g)
            if sc > best[1]:
                best = (L, sc)
    return best
