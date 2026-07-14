#!/usr/bin/env python3
"""mcq_parser_v6.py — Dedicated Section 1 MCQ Extractor for NSC Papers.

Uses the same row-based word-level extraction as qp_content_parser.py
but with stricter column filtering and multi-strategy option detection.

Key design decisions:
1. Reuses _detect_bilingual_columns / _get_rows logic (self-contained)
2. Only processes questions 1.1.1 – 1.1.10 (Section 1 of NSC papers)
3. Multi-strategy option extraction: row-based → ordered-text → header-values
4. Cross-references memo for correct answers via memo_content_parser
5. Returns harness-compatible format
"""

import re
import json
import fitz

# ------------------------------------------------------------------
# Shared extraction utilities (duplicated from qp_content_parser for
# self-containment — avoids import fragility)
# ------------------------------------------------------------------

def _clean(tok):
    """Strip private-use-area glyph artifacts."""
    return re.sub(r'[-]', '', tok).strip()


def _detect_bilingual_columns(page):
    """Detect if page has bilingual layout and return column boundaries.
    Returns (is_bilingual, left_max_x, right_min_x) or (False, None, None).
    """
    words = page.get_text("words")
    if not words or len(words) < 20:
        return False, None, None

    page_width = page.rect.width
    mid = page_width * 0.5

    left_words = [w for w in words if w[0] < mid - 20]
    right_words = [w for w in words if w[0] > mid + 20]

    if len(left_words) < 15 or len(right_words) < 15:
        return False, None, None

    x_positions = sorted([w[0] for w in words])
    gaps = []
    for i in range(1, len(x_positions)):
        gap = x_positions[i] - x_positions[i-1]
        if gap > 30:
            gaps.append((gap, x_positions[i-1], x_positions[i]))

    if gaps:
        mid_third_start = page_width * 0.33
        mid_third_end = page_width * 0.67
        mid_gaps = [g for g in gaps if mid_third_start < g[1] < mid_third_end]
        if mid_gaps:
            mid_gaps.sort(reverse=True)
            _, left_max, right_min = mid_gaps[0]
            return True, left_max + 10, right_min - 10

    return True, mid - 10, mid + 10


def _get_rows(page, y_tol=3, language='ENG'):
    """Group a page's words into visual rows, sorted top-to-bottom / left-to-right.
    For bilingual pages, extracts only the specified language column.
    """
    raw_words = page.get_text("words")
    page_width = page.rect.width

    is_bilingual, left_max_x, right_min_x = _detect_bilingual_columns(page)

    words = []
    for w in raw_words:
        text = _clean(w[4])
        if not text:
            continue

        if is_bilingual and left_max_x is not None and right_min_x is not None:
            if language.upper() == 'AFR':
                if w[0] < right_min_x:
                    continue
            else:
                if w[0] > left_max_x:
                    continue

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


# ------------------------------------------------------------------
# MCQ-specific patterns
# ------------------------------------------------------------------

SECTION1_RE = re.compile(r'^1\.1\.(\d{1,2})\b')
ANY_QNUM_RE = re.compile(r'^\d+\.\d+(?:\.\d+)?\b')
OPTION_ROW_RE = re.compile(r'^([A-D])[\.\)\s]\s*(.*)')
HEADER_ROW_RE = re.compile(r'^[A-D][\.\s]*[A-D][\.\s]*[A-D][\.\s]*[A-D]\s*$')
TRAILING_MARKS_RE = re.compile(r'\(\s*[\dx\s]+\)\s*$')
FOOTER_RE = re.compile(
    r'^(Life\s+Sciences|Sciences/P\d|DBE/|NSC|Copyright|Please\s+turn\s+over|'
    r'Please|reserved|turn|over|Confidential|Instructions|Answer\s+ONLY|'
    r'QUESTION|SECTION|MARKS|TIME|Number|the\s+answer|book|only|candidate|'
    r'may\s+write|within\s+the|margin|GRAND\s+TOTAL|TOTAL\s+SECTION|'
    r'\(\d+\s*marks?\)|\(\d+\s*x\s*\d+\s*\)\s*\(\d+\))',
    re.IGNORECASE
)
INSTRUCTION_RE = re.compile(
    r'(?:Write\s+(?:only|down|the)\s+(?:term|letter|number|answer)|'
    r'COLUMN\s+I|COLUMN\s+II|'
    r'Give\s+the\s+correct|'
    r'Indicate\s+whether|'
    r'Choose\s+the\s+correct|'
    r'Select\s+the\s+correct)',
    re.IGNORECASE
)


def _is_noise(text):
    """Skip footer, instruction, and pure-marks rows."""
    t = text.strip()
    if not t:
        return True
    if FOOTER_RE.match(t):
        return True
    if INSTRUCTION_RE.search(t) and len(t) > 20:
        return True
    if re.match(r'^\(\d+\s*x\s*\d+\)\s*\(\d+\)$', t):
        return True
    return False


def _strip_trailing_marks(text):
    """Remove trailing (N) or (N x M) (P) marks notation."""
    prev = None
    while prev != text:
        prev = text
        text = TRAILING_MARKS_RE.sub('', text).strip()
    return text


# ------------------------------------------------------------------
# Option extraction strategies
# ------------------------------------------------------------------

def _strategy_row_based(rows):
    """Strategy 1: Rows that start with A. / B) / C / D etc."""
    option_rows = {}
    stem_rows = []

    for row in rows:
        row = row.strip()
        if not row or _is_noise(row):
            continue

        m = OPTION_ROW_RE.match(row)
        if m:
            label, text = m.group(1), m.group(2).strip()
            text = _strip_trailing_marks(text)
            if text:
                option_rows[label] = text
        else:
            stem_rows.append(row)

    if len(option_rows) >= 2:
        stem = ' '.join(stem_rows).strip()
        return stem, option_rows
    return None, None


def _strategy_header_values(rows):
    """Strategy 2: Header row 'A B C D' followed by values row."""
    for i, row in enumerate(rows):
        if HEADER_ROW_RE.match(row.strip()):
            if i + 1 < len(rows):
                values_row = rows[i + 1].strip()
                # Split by 2+ spaces (table column gaps)
                fragments = re.split(r'\s{2,}', values_row)
                if len(fragments) >= 4:
                    stem_rows = [r for r in rows[:i] if not _is_noise(r)]
                    stem = ' '.join(stem_rows).strip()
                    options = {
                        'A': _strip_trailing_marks(fragments[0].strip()),
                        'B': _strip_trailing_marks(fragments[1].strip()),
                        'C': _strip_trailing_marks(fragments[2].strip()),
                        'D': _strip_trailing_marks(fragments[3].strip()),
                    }
                    return stem, options
    return None, None


def _strategy_ordered_text(full_text):
    """Strategy 3: Find A, B, C, D in order within the full text.
    Uses strict word-boundary matching to avoid false positives.
    """
    full_text = re.sub(r'\s+', ' ', full_text).strip()

    # Find labels in order A → B → C → D
    # Pattern: label not preceded by word char, followed by . ) or space, then text
    def find_label(text, label):
        pattern = rf'(?<![a-zA-Z]){label}(?:[\.\)\s]+|\s+)(?=[^\s])'
        return re.search(pattern, text)

    a_match = find_label(full_text, 'A')
    if not a_match:
        return None, None

    after_a = full_text[a_match.end():]
    b_match = find_label(after_a, 'B')
    if not b_match:
        return None, None

    after_b = after_a[b_match.end():]
    c_match = find_label(after_b, 'C')
    if not c_match:
        return None, None

    after_c = after_b[c_match.end():]
    d_match = find_label(after_c, 'D')
    if not d_match:
        return None, None

    # Extract stem (everything before first A)
    stem = full_text[:a_match.start()].strip()

    # Extract options (text between labels)
    opt_a = after_a[:b_match.start()].strip()
    opt_b = after_b[:c_match.start()].strip()
    opt_c = after_c[:d_match.start()].strip()
    opt_d = after_c[d_match.end():].strip()

    # Remove corresponding labels from option text (handle duplicate labels at start)
    options_texts = {'A': opt_a, 'B': opt_b, 'C': opt_c, 'D': opt_d}
    options = {}
    for label, text in options_texts.items():
        for _ in range(3):
            new_text = re.sub(rf'^{label}(?:[\.\)\s]+|\s+)', '', text)
            if new_text == text:
                break
            text = new_text
        options[label] = _strip_trailing_marks(text)

    return stem, options


def _validate_mcq(stem, options):
    """Validate extracted MCQ data."""
    if not stem or len(stem) < 10:
        return False, 'Stem too short or empty'
    if len(options) < 2:
        return False, f'Missing options: {", ".join(options.keys()) if options else "None"}'
    # Check each option has reasonable length
    for label, text in options.items():
        if len(text) < 2:
            return False, f'Option {label} too short: "{text}"'
        if len(text.split()) > 25:
            return False, f'Option {label} suspiciously long ({len(text.split())} words)'
    return True, 'OK'


def extract_mcq_from_rows(rows):
    """Try all strategies in order of reliability."""
    full_text = ' '.join(r for r in rows if not _is_noise(r)).strip()
    full_text = re.sub(r'\s+', ' ', full_text)

    # Strategy 1: Row-based option rows (most reliable)
    stem, options = _strategy_row_based(rows)
    if options and len(options) >= 4:
        ok, msg = _validate_mcq(stem, options)
        if ok:
            return stem, options

    # Strategy 2: Header + values row
    stem, options = _strategy_header_values(rows)
    if options and len(options) >= 4:
        ok, msg = _validate_mcq(stem, options)
        if ok:
            return stem, options

    # Strategy 3: Ordered text extraction (most versatile)
    stem, options = _strategy_ordered_text(full_text)
    if options and len(options) >= 2:
        ok, msg = _validate_mcq(stem, options)
        if ok:
            return stem, options

    # Fallback: accept whatever we got from strategy 1 or 2 with >=2 options
    stem, options = _strategy_row_based(rows)
    if options and len(options) >= 2:
        ok, msg = _validate_mcq(stem, options)
        if ok:
            return stem, options

    stem, options = _strategy_header_values(rows)
    if options and len(options) >= 2:
        ok, msg = _validate_mcq(stem, options)
        if ok:
            return stem, options

    return None, None


# ------------------------------------------------------------------
# Main extraction functions
# ------------------------------------------------------------------

def extract_section1_mcq_items(qp_path, memo_path):
    """Extract Section 1 MCQ items from QP and cross-reference with memo.

    Returns list of dicts:
    {
        'question_number': '1.1.1',
        'stem': '...',
        'options': {'A': '...', 'B': '...', ...},
        'correct_answer': 'C',
        'is_valid': True/False,
        'raw_text': '...'  # for debugging
    }
    """
    # --- Step 1: Extract all English-column rows from QP ---
    doc = fitz.open(qp_path)
    all_rows = []
    for page_num, page in enumerate(doc):
        for row in _get_rows(page, language='ENG'):
            row_text = ' '.join(w['text'] for w in row['words'])
            if row_text.strip():
                all_rows.append({
                    'page_num': page_num,
                    'top': row['top'],
                    'text': row_text
                })
    doc.close()

    # --- Step 2: Collect text segments per Section 1 question ---
    items = {}
    current_q = None

    for row in all_rows:
        text = row['text'].strip()
        if not text:
            continue

        match = SECTION1_RE.match(text)
        if match:
            q_num = f"1.1.{match.group(1)}"
            current_q = q_num
            if q_num not in items:
                items[q_num] = []
            remaining = text[match.end():].strip()
            if remaining:
                items[q_num].append(remaining)
        elif current_q:
            # Stop collecting if we hit a non-Section-1 question
            if ANY_QNUM_RE.match(text) and not SECTION1_RE.match(text):
                current_q = None
            elif current_q:
                if not _is_noise(text):
                    items[current_q].append(text)

    # --- Step 3: Extract stem + options for each question ---
    raw_items = []
    for q_num in sorted(items.keys(), key=lambda x: int(x.split('.')[2])):
        rows = items[q_num]
        stem, options = extract_mcq_from_rows(rows)

        if stem and options:
            raw_items.append({
                'question_number': q_num,
                'stem': stem,
                'options': options,
                'is_valid': True,
                'raw_text': ' '.join(rows)
            })
        else:
            raw_items.append({
                'question_number': q_num,
                'stem': ' '.join(r for r in rows if not _is_noise(r)).strip(),
                'options': options or {},
                'is_valid': False,
                'raw_text': ' '.join(rows)
            })

    # --- Step 4: Cross-reference with memo for correct answers ---
    memo_answers = _extract_mcq_answers_from_memo(memo_path)
    for item in raw_items:
        qn = item['question_number']
        if qn in memo_answers:
            item['correct_answer'] = memo_answers[qn]
        else:
            item['correct_answer'] = ''

    return raw_items


def _extract_mcq_answers_from_memo(memo_path):
    """Extract correct answers for Section 1 from memo."""
    try:
        from memo_content_parser import extract_memo_content
        memo_items = extract_memo_content(memo_path)
    except Exception as e:
        print(f"[MCQ Parser v6] Warning: could not load memo parser: {e}")
        return {}

    answers = {}
    for item in memo_items:
        qn = item.get('question_number', '')
        if not qn.startswith('1.1.'):
            continue
        correct_key = item.get('correct_key', '')
        if correct_key:
            answers[qn] = correct_key

    return answers


def convert_to_harness_format(raw_items):
    """Convert raw MCQ items to the format expected by master_harness_v3.

    Each item needs these fields (mirrors combined_item structure):
    - question_number
    - question_text (stem)
    - marks (default 2 for Section 1 MCQs, overwritten by marks parser)
    - expected_marks
    - answer_text
    - correct_key
    - is_mcq = 1
    - mcq_options (JSON string)
    - item_answer_json (JSON string with options + type + correct_answer)
    - images = []
    - is_header = 0
    - header_level = 3
    - source = 'mcq_parser_v6'
    """
    result = []
    for item in raw_items:
        if not item.get('is_valid'):
            continue

        options = item.get('options', {})
        correct_answer = item.get('correct_answer', '')

        # Build item_answer_json for frontend + DB
        answer_payload = {
            'options': options,
            'type': 'mcq_single',
            'correct_answer': correct_answer
        }
        item_answer_json = json.dumps(answer_payload, ensure_ascii=False)
        mcq_options_json = json.dumps(options, ensure_ascii=False)

        # Build answer_text from correct answer (for register display)
        answer_text = correct_answer
        if correct_answer and options.get(correct_answer):
            answer_text = f"{correct_answer} — {options[correct_answer]}"

        harness_item = {
            'question_number': item['question_number'],
            'question_text': item['stem'],
            'marks': 2,  # Default for Section 1; overwritten by marks parser in harness
            'expected_marks': 2,
            'answer_text': answer_text,
            'correct_key': correct_answer,
            'is_mcq': 1,
            'item_type_id': 1,  # MCQ type (lookup_item_types.type_id = 1)
            'mcq_options': mcq_options_json,
            'item_answer_json': item_answer_json,
            'images': [],
            'is_header': 0,
            'header_level': 3,
            'source': 'mcq_parser_v6',
        }
        result.append(harness_item)

    return result


# ------------------------------------------------------------------
# CLI / Standalone test
# ------------------------------------------------------------------

if __name__ == '__main__':
    import sys, argparse

    parser = argparse.ArgumentParser(description='MCQ Parser v6 — Section 1 extractor')
    parser.add_argument('--qp', required=True, help='Path to QP PDF')
    parser.add_argument('--memo', required=True, help='Path to Memo PDF')
    parser.add_argument('-o', '--output', help='Output JSON file')
    parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')
    args = parser.parse_args()

    raw_items = extract_section1_mcq_items(args.qp, args.memo)
    harness_items = convert_to_harness_format(raw_items)

    valid = [i for i in raw_items if i['is_valid']]
    invalid = [i for i in raw_items if not i['is_valid']]

    print("=" * 60)
    print("MCQ Parser v6 Results")
    print("=" * 60)
    print(f"Total items found: {len(raw_items)}")
    print(f"Valid MCQs: {len(valid)}")
    print(f"Invalid/Flagged: {len(invalid)}")
    print()

    if valid:
        print("Valid items:")
        for item in valid:
            print(f"  {item['question_number']}: {item['stem'][:80]}...")
            for lbl, txt in sorted(item['options'].items()):
                mark = '✓' if item.get('correct_answer') == lbl else ' '
                print(f"    {mark} {lbl}: {txt[:60]}")
        print()

    if invalid and args.verbose:
        print("Invalid items:")
        for item in invalid:
            print(f"  {item['question_number']}: {item['raw_text'][:120]}")
        print()

    output_data = {
        'parser': 'mcq_parser_v6',
        'valid_count': len(valid),
        'invalid_count': len(invalid),
        'valid_items': valid,
        'invalid_items': invalid,
        'harness_items': harness_items
    }

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        print(f"Output saved to: {args.output}")
    else:
        print(json.dumps(output_data, indent=2, ensure_ascii=False))
