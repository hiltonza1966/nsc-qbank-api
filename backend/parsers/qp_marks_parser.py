#!/usr/bin/env python3
"""qp_marks_parser.py v4 - position/layout-aware marks extraction.

Same underlying problem as memo_content_parser v4: PyMuPDF's/pdftotext's
linear text stream does not preserve the visual row order of these DBE
question papers. Header mark totals (e.g. "TOTAL SECTION A: 50", or a
sub-header's "(10 x 2) (20)") frequently sit on the same VISUAL row as their
label, but are separated from it in the raw text stream by unrelated
content (footers, other columns, etc). A proximity/regex search over the
linear text - which is what v3.1 did - either finds nothing within its
distance cutoff, or matches the wrong nearby number.

This version groups words by their actual page position (bounding boxes)
into visual rows first, so pairing a label with its own mark total no
longer depends on how PyMuPDF happened to order the underlying content
stream.
"""
import re
import json
import fitz

try:
    from bilingual_cleaner import extract_english_from_bilingual
except ImportError:
    def extract_english_from_bilingual(text):
        return text

QNUM_RE = re.compile(r'^\d+\.\d+(?:\.\d+)?$')
SUBLABEL_RE = re.compile(r'^\(([a-zA-Z])\)$')
NUM_COL_X = 130
MARKS_ZONE_X = 470  # marks column starts roughly here on these papers


def _clean(tok):
    return re.sub(r'[\uf000-\uf8ff]', '', tok).strip()


def _get_rows(page, y_tol=3):
    raw_words = page.get_text("words")
    words = []
    for w in raw_words:
        text = _clean(w[4])
        if text:
            words.append({'x0': w[0], 'top': w[1], 'text': text})
    words.sort(key=lambda w: (w['top'], w['x0']))

    rows = []
    for w in words:
        placed = False
        for r in rows:
            if abs(r['top'] - w['top']) <= y_tol:
                r['words'].append(w)
                placed = True
                break
        if not placed:
            rows.append({'top': w['top'], 'words': [w]})
    for r in rows:
        r['words'].sort(key=lambda w: w['x0'])
    rows.sort(key=lambda r: r['top'])
    return rows


def _row_marks(tokens):
    """Look for a trailing '(N)' in the marks column of a row (tolerates
    digits/parens that arrived as separately-kerned word tokens)."""
    zone = [t for t in tokens if t[0] >= MARKS_ZONE_X]
    if not zone:
        return None
    joined = ''.join(t for _, t in zone)
    m = re.search(r'\(\s*(\d+)\s*\)\s*$', joined)
    return int(m.group(1)) if m else None


def _row_multiplier(all_tokens_text):
    """e.g. '(10 x 2) (20)' -> (per_item=2, total=20)."""
    joined = re.sub(r'\s+', '', all_tokens_text)
    m = re.search(r'\((\d+)x(\d+)\)\((\d+)\)', joined)
    if m:
        return int(m.group(2)), int(m.group(3))
    return None


def extract_text_from_pdf(pdf_path):
    """Kept for callers/back-compat that only want raw text + per-page text."""
    doc = fitz.open(pdf_path)
    all_text = ""
    page_texts = []
    for page_num, page in enumerate(doc):
        text = page.get_text()
        if text:
            all_text += text + "\n"
            page_texts.append({'page_num': page_num + 1, 'text': text})
    doc.close()
    return extract_english_from_bilingual(all_text), page_texts


def extract_qp_marks(pdf_path):
    """Extract section totals, header totals and individual item marks
    using position-aware row reconstruction."""
    doc = fitz.open(pdf_path)

    section_totals = {}     # {'1': 50, '2': 100, ...} keyed by main question / section number
    header_marks = {}       # {'1.1': 20, '1.2': 8, ...}
    item_marks = {}         # {'1.1.1': 2, '2.2.3': 5, ...}
    sub_part_marks = {}     # {'1.4.1': {'a': 1, 'b': 2, 'c': 1}, ...}

    current_header = None
    current_item = None
    pending_group = []      # 3-part item numbers under current_header awaiting a header total

    for page in doc:
        for row in _get_rows(page):
            toks = [(w['x0'], w['text']) for w in row['words']]
            if not toks:
                continue

            row_text = ' '.join(t for _, t in toks)

            # --- top-level section / question totals -------------------------------
            m = re.search(r'QUESTION\s+(\d+)\s*\((\d+)\s*marks?', row_text, re.IGNORECASE)
            if m:
                section_totals[m.group(1)] = int(m.group(2))

            m = re.search(r'TOTAL\s+SECTION\s+([A-Z]):\s*(\d+)', row_text, re.IGNORECASE)
            if m:
                section_num = str(ord(m.group(1).upper()) - ord('A') + 1)
                section_totals[section_num] = int(m.group(2))

            m = re.search(r'GRAND\s+TOTAL:\s*(\d+)', row_text, re.IGNORECASE)
            if m and '1' not in section_totals:
                section_totals['1'] = int(m.group(1))

            # --- question-number / marks columns -----------------------------------
            left_nums = [t for t in toks if t[0] < NUM_COL_X and QNUM_RE.match(t[1])]
            rest = [t for t in toks if t not in left_nums]

            row_qnum = None
            if left_nums:
                candidate = left_nums[-1][1]
                if len(candidate.split('.')) == 2:
                    current_header = candidate
                    current_item = None
                    header_marks.setdefault(current_header, 0)
                    pending_group = []
                else:
                    row_qnum = candidate

            marks_here = _row_marks(rest if rest else toks)
            multiplier = _row_multiplier(row_text)

            if row_qnum:
                current_item = row_qnum
                item_marks.setdefault(current_item, 0)
                if current_header and current_item.startswith(current_header + '.'):
                    if current_item not in pending_group:
                        pending_group.append(current_item)
                if marks_here is not None:
                    item_marks[current_item] = marks_here

            elif rest:
                lab_match = SUBLABEL_RE.match(rest[0][1]) if rest else None
                content_toks = [t for t in rest if t[0] < MARKS_ZONE_X]
                if lab_match and current_item:
                    label = lab_match.group(1).lower()
                    if marks_here is not None:
                        sub_part_marks.setdefault(current_item, {})[label] = marks_here
                elif content_toks and (current_item or current_header) and not multiplier:
                    # wrapped continuation text: belongs to the current sub-item if one
                    # is open, otherwise (a "flat" header with no numbered sub-parts,
                    # e.g. "3.3 Describe how the eye accommodates... (5)") to the header
                    if marks_here is not None:
                        if current_item:
                            item_marks[current_item] = marks_here
                        elif current_header:
                            header_marks[current_header] = marks_here
                elif marks_here is not None and not multiplier:
                    # a bare row with nothing but a mark total -> header total
                    if current_header:
                        header_marks[current_header] = marks_here

            if multiplier:
                per_item, total = multiplier
                for q in pending_group:
                    item_marks[q] = per_item
                if current_header:
                    header_marks[current_header] = total
                pending_group = []

    doc.close()

    # fold (a)/(b)/(c) sub-part marks into their parent 3-part item's total
    for q, parts in sub_part_marks.items():
        s = sum(parts.values())
        if s:
            item_marks[q] = s

    result = []
    for main_q, marks in section_totals.items():
        result.append({'question_number': main_q, 'marks': marks, 'source': 'qp_section_total'})
    for q, marks in header_marks.items():
        if marks:
            result.append({'question_number': q, 'marks': marks, 'source': 'qp_header_total'})
    for q, marks in item_marks.items():
        if marks:
            result.append({'question_number': q, 'marks': marks, 'source': 'qp_item'})

    result.sort(key=lambda x: [int(n) for n in x['question_number'].split('.')])
    return result


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        items = extract_qp_marks(sys.argv[1])
        print(json.dumps(items, indent=2))
