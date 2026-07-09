#!/usr/bin/env python3
"""memo_content_parser.py v4 - position/layout-aware answer extraction.

WHY THIS VERSION EXISTS
------------------------
DBE marking-guideline PDFs lay sub-question numbers and their answers out in
two side-by-side columns (number column ~x=107, answer column ~x=164, marks
column ~x=480-560). PyMuPDF's/pdftotext's plain text mode does not always
preserve this left-to-right reading order - for many of these PDFs it emits
ALL the numbers in a block first, then ALL the answers, then the marks
notation (a column-major dump instead of row-major). E.g. for 1.1:

    1.1.1 1.1.2 1.1.3 ... 1.1.10   C A D A C D B D B A   (10 x 2) (20)

Any parser that looks for "the text between one question-number match and
the next" (the approach in v3.1) finds an EMPTY segment for 1.1.1-1.1.9
(they're immediately followed by 1.1.2, 1.1.3, ... with nothing in between)
and gets a single blob of 10 concatenated letters dumped onto 1.1.10. That is
the actual cause of the "missing items" / "wrong answers" bugs described in
the handover note - it is not a coincidence limited to one paper.

This version reads word-level bounding boxes (fitz `page.get_text("words")`)
and groups words into visual rows by y-position first, then reconstructs
each item from its own row (plus any (a)/(b)/(c) continuation rows), so the
column order in the underlying PDF content stream no longer matters.
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
NUM_COL_X = 130      # question-number column ends roughly here
FOOTER_RE = re.compile(
    r'^(Life|Sciences/P\d|DBE/|NSC|Copyright|Please|reserved|turn|over|'
    r'Confidential|Marking|Guidelines|SECTION|QUESTION|TOTAL|GRAND)',
    re.IGNORECASE
)
TRAILING_MARKS_RE = re.compile(r'\(\s*[\dx\s]+\)\s*$')


def _clean(tok):
    """Strip private-use-area glyph artifacts (checkbox/tick fonts etc.)."""
    return re.sub(r'[\uf000-\uf8ff]', '', tok).strip()


def _get_rows(page, y_tol=3):
    """Group a page's words into visual rows, sorted top-to-bottom / left-to-right."""
    raw_words = page.get_text("words")  # (x0, y0, x1, y1, word, block, line, word_no)
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


def _strip_trailing_marks(text):
    """Remove one or more trailing '(N)' / '(N x M)' groups that ride along
    on the same row as the final answer in a block (e.g. '... A (10 x 2) (20)')."""
    prev = None
    while prev != text:
        prev = text
        text = TRAILING_MARKS_RE.sub('', text).strip()
    return text


def _append_segment(items, q_num, tokens):
    """Append a row's content tokens to an item, handling an optional
    leading (a)/(b)/(c) sub-part label and stripping any inline mark total."""
    if not tokens:
        return
    lab_match = SUBLABEL_RE.match(tokens[0][1])
    if lab_match:
        label = lab_match.group(1).lower()
        text = ' '.join(t for _, t in tokens[1:]).strip()
        text = TRAILING_MARKS_RE.sub('', text).strip()
        if text:
            items[q_num].append(f"({label}) {text}")
    else:
        text = ' '.join(t for _, t in tokens).strip()
        if text and not FOOTER_RE.match(text):
            items[q_num].append(text)


def _classify_answer(text):
    """Classify a cleaned answer string the same way earlier parser versions did,
    so downstream code (MCQ matching, correct_key lookup) keeps working unchanged."""
    t = text.strip()

    m = re.match(r'^([A-D])$', t)
    if m:
        return t, m.group(1), True, 'mcq_single'

    m = re.match(r'^(Both\s+[A-D]\s+and\s+[A-D]|[A-D]\s+only|[A-D]\s+and\s+[A-D])$', t, re.IGNORECASE)
    if m:
        keys = re.findall(r'[A-D]', m.group(1))
        return m.group(1), keys, True, 'mcq_multiple'

    m = re.match(r'^(TRUE|FALSE)$', t, re.IGNORECASE)
    if m:
        return t.upper(), t.upper(), True, 'mcq_true_false'

    m = re.match(r'^\(a\)\s*(\S.*?)\s*\(b\)\s*(\S.*?)(?:\s*\(c\)\s*(\S.*))?$', t, re.IGNORECASE)
    if m:
        parts = [p for p in m.groups() if p]
        labels = ['a', 'b', 'c'][:len(parts)]
        answer_text = ' '.join(f"({lab}) {val}" for lab, val in zip(labels, parts))
        return answer_text, None, True, 'mcq_complex'

    return t, None, False, None


def extract_memo_text(pdf_path):
    """Kept for backward compatibility with callers that only want raw text."""
    doc = fitz.open(pdf_path)
    all_text = ""
    for page in doc:
        text = page.get_text()
        if text:
            all_text += text + "\n"
    doc.close()
    return extract_english_from_bilingual(all_text)


def extract_memo_content(pdf_path, output_dir=None):
    """Extract memo items using position-aware row reconstruction."""
    doc = fitz.open(pdf_path)
    items = {}
    order = []
    current_q = None

    for page in doc:
        for row in _get_rows(page):
            toks = [(w['x0'], w['text']) for w in row['words']]
            if not toks:
                continue

            # Only pull out tokens that are actually a question-number label from
            # the left margin; everything else stays in the content stream
            # regardless of its exact x-position (bullets/indents vary row to row).
            left_nums = [t for t in toks if t[0] < NUM_COL_X and QNUM_RE.match(t[1])]
            rest = [t for t in toks if t not in left_nums]

            row_qnum = None
            if left_nums:
                candidate = left_nums[-1][1]
                is_bare_header_line = len(candidate.split('.')) == 2 and not rest and len(left_nums) == 1
                if not is_bare_header_line:
                    row_qnum = candidate

            if row_qnum:
                current_q = row_qnum
                if current_q not in items:
                    items[current_q] = []
                    order.append(current_q)
                _append_segment(items, current_q, rest)
            elif current_q is not None:
                _append_segment(items, current_q, toks)

    doc.close()

    result = []
    for q in order:
        raw = ' '.join(items[q]).strip()
        raw = _strip_trailing_marks(raw)
        raw = re.sub(r'\s+', ' ', raw).strip()
        if not raw:
            continue
        answer_text, correct_key, is_mcq, mcq_type = _classify_answer(raw)
        result.append({
            'question_number': q,
            'answer_text': answer_text,
            'correct_key': correct_key,
            'is_mcq': is_mcq,
            'mcq_type': mcq_type
        })

    result.sort(key=lambda x: [int(n) for n in x['question_number'].split('.')])
    return result


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        items = extract_memo_content(sys.argv[1])
        print(json.dumps(items, indent=2, default=str))
