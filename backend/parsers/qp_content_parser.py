#!/usr/bin/env python3
"""qp_content_parser.py v5.1 - position/layout-aware question content extraction.

Fixes v5.0 issues:
- NUM_COL_X increased to 160 (was 130) to catch indented numbers
- Better instruction block detection to prevent text contamination
- Stricter MCQ regex to avoid false positives
- Section break detection for "COLUMN" headers and instruction text
- Handles sub-items where number is on same row as content
"""
import os
import re
import json
import fitz

try:
    from bilingual_cleaner import extract_english_from_bilingual
except ImportError:
    def extract_english_from_bilingual(text):
        return text

# ------------------------------------------------------------------
# Constants
# ------------------------------------------------------------------
QNUM_RE = re.compile(r'^\d+\.\d+(?:\.\d+)?$')
NUM_COL_X = 200          # INCREASED from 130 — catch indented numbers
MARKS_ZONE_X = 470       # marks column starts roughly here — ignore text beyond this
Y_TOLERANCE = 3          # pixels of vertical slop for row grouping

FOOTER_RE = re.compile(
    r'^(Life\s+Sciences|Sciences/P\d|DBE/|NSC|Copyright|Please\s+turn\s+over|'
    r'Please|reserved|turn|over|Confidential|Instructions|Answer\s+ONLY|'
    r'QUESTION|SECTION|MARKS|TIME|Number|the\s+answer|book|only|candidate|'
    r'may\s+write|within\s+the|margin|GRAND\s+TOTAL|TOTAL\s+SECTION|'
    r'\(\d+\s*marks?\)|\(\d+\s*x\s*\d+\s*\)\s*\(\d+\))',
    re.IGNORECASE
)

# Stricter MCQ regex — requires proper option format and longer text
# Only matches at word boundaries or after clear separators
MCQ_OPTION_RE = re.compile(
    r'(?:^|\s)([A-D])[\.\)\s]\s*([A-Za-z][^A-D]{4,120}?)(?=(?:\s+[A-D])[\.\)\s]|$)'
)

# Instruction patterns that signal a new section
SECTION_BREAK_RE = re.compile(
    r'(?:Write\s+(?:only|down|the)\s+(?:term|letter|number|answer)|'
    r'COLUMN\s+I|COLUMN\s+II|'
    r'Give\s+the\s+correct|'
    r'Indicate\s+whether|'
    r'Choose\s+the\s+correct|'
    r'Select\s+the\s+correct)',
    re.IGNORECASE
)


def _clean(tok):
    """Strip private-use-area glyph artifacts."""
    return re.sub(r'[\uf000-\uf8ff]', '', tok).strip()


def _detect_bilingual_columns(page):
    """Detect if page has bilingual layout and return column boundaries.
    Returns (is_bilingual, left_max_x, right_min_x) or (False, None, None).
    """
    words = page.get_text("words")
    if not words or len(words) < 20:
        return False, None, None

    page_width = page.rect.width
    mid = page_width * 0.5

    # Count words in left vs right half
    left_words = [w for w in words if w[0] < mid - 20]
    right_words = [w for w in words if w[0] > mid + 20]

    # Bilingual if both sides have substantial text (at least 15 words each)
    if len(left_words) < 15 or len(right_words) < 15:
        return False, None, None

    # Find the gap between columns (minimum word density zone)
    x_positions = sorted([w[0] for w in words])
    gaps = []
    for i in range(1, len(x_positions)):
        gap = x_positions[i] - x_positions[i-1]
        if gap > 30:  # Significant gap
            gaps.append((gap, x_positions[i-1], x_positions[i]))

    # Find the largest gap in the middle third of the page
    if gaps:
        mid_third_start = page_width * 0.33
        mid_third_end = page_width * 0.67
        mid_gaps = [g for g in gaps if mid_third_start < g[1] < mid_third_end]
        if mid_gaps:
            mid_gaps.sort(reverse=True)
            _, left_max, right_min = mid_gaps[0]
            return True, left_max + 10, right_min - 10

    # Fallback: use midpoint
    return True, mid - 10, mid + 10


def _get_rows(page, y_tol=Y_TOLERANCE, language='ENG'):
    """Group a page's words into visual rows, sorted top-to-bottom / left-to-right.

    For bilingual pages, extracts only the specified language column:
    - ENG: left column (English)
    - AFR: right column (Afrikaans)
    """
    raw_words = page.get_text("words")
    page_width = page.rect.width

    # Detect bilingual layout
    is_bilingual, left_max_x, right_min_x = _detect_bilingual_columns(page)

    words = []
    for w in raw_words:
        text = _clean(w[4])
        if not text:
            continue

        # Bilingual filtering: only keep words from the correct column
        if is_bilingual and left_max_x is not None and right_min_x is not None:
            if language.upper() == 'AFR':
                # Afrikaans: right column
                if w[0] < right_min_x:
                    continue
            else:
                # English (default): left column
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


def _extract_images(doc, page, page_num, output_dir):
    """Extract images from a page and return metadata list."""
    images = []
    if not output_dir:
        return images

    img_list = page.get_images(full=True)
    for img_index, img in enumerate(img_list):
        xref = img[0]
        try:
            pix = fitz.Pixmap(doc, xref)
            if pix.n > 4:  # CMYK: convert to RGB
                pix = fitz.Pixmap(fitz.csRGB, pix)
            img_filename = f"page_{page_num + 1}_img_{img_index}.png"
            img_path = os.path.join(output_dir, img_filename)
            pix.save(img_path)

            img_rects = page.get_image_rects(xref)
            if img_rects:
                rect = img_rects[0]
                images.append({
                    'filename': img_filename,
                    'page': page_num + 1,
                    'bbox': [rect.x0, rect.y0, rect.x1, rect.y1]
                })
        except Exception:
            continue
    return images


def _is_instruction_block(text):
    """Detect pure instruction lines (e.g. 'Give the LETTER ...')."""
    t = text.lower()
    return any(phrase in t for phrase in [
        'give the letter', 'write only the letter', 'choose the correct',
        'select the correct', 'indicate whether', 'answer sheet',
        'answer book', 'write down only', 'write the term',
        'write only the term', 'column i', 'column ii',
        'both a and b', 'b only', 'a only', 'none of the',
        'next to the question numbers', 'write b or', 'write a only'
    ])


def _is_likely_option_text(text):
    """Check if text looks like a proper MCQ option (complete phrase, not fragment)."""
    if len(text) < 5:
        return False
    # Should contain at least one word character
    if not re.search(r'[a-zA-Z]{2,}', text):
        return False
    # Should not be just a number or symbol
    if re.match(r'^[^a-zA-Z]*$', text):
        return False
    return True


def _extract_mcq_options(text):
    """Extract MCQ options from text. Returns (clean_text, options_dict or None)."""
    # Find all potential option matches
    matches = list(MCQ_OPTION_RE.finditer(text))
    if len(matches) < 2:
        return text, None

    # Build options dict, filtering out bad matches
    options = {}
    for m in matches:
        label = m.group(1)
        opt_text = m.group(2).strip()
        if _is_likely_option_text(opt_text):
            options[label] = opt_text

    # Require at least 2 valid options
    if len(options) < 2:
        return text, None

    # Check that options are in a block at the end (or reasonable position)
    # Find the start of the first option
    first_opt_start = matches[0].start()
    question_part = text[:first_opt_start].strip()

    # If question part is too short, options might be the whole text — reject
    if len(question_part) < 10:
        return text, None

    return question_part, options


def extract_qp_text(pdf_path):
    """Kept for backward compatibility with callers that only want raw text."""
    doc = fitz.open(pdf_path)
    all_text = ""
    for page in doc:
        text = page.get_text()
        if text:
            all_text += text + "\n"
    doc.close()
    return extract_english_from_bilingual(all_text)


def extract_qp_content(pdf_path, output_dir=None):
    """Extract QP items using position-aware row reconstruction.

    Returns a list of dicts with keys:
        question_number   : str   e.g. "1.2.1"
        question_text     : str   clean text (options stripped)
        raw_text          : str   original text before cleaning
        is_header         : int   1 if this is a header (e.g. 1.2, 2.3)
        header_level      : int   depth: 1=main, 2=header, 3=sub-item
        is_mcq            : int   1 if MCQ options detected
        mcq_options       : str   JSON string of {A: "...", B: "..."}
        item_answer_json  : str   JSON with options + type
        qp_images         : list  image metadata for this item
        marks             : None  (filled later by marks parser)
    """
    # Detect language from filename
    filename = os.path.basename(pdf_path).upper()
    language = 'AFR' if 'AFR' in filename or 'AFRIKAANS' in filename else 'ENG'

    doc = fitz.open(pdf_path)
    items = {}          # q_num -> list of text segments
    order = []          # preserve extraction order
    current_q = None
    all_images = []     # global image list, filtered per-item later

    for page_num, page in enumerate(doc):
        # Images handled by attachment_parser.py — not extracted here
        # page_images = _extract_images(doc, page, page_num, output_dir)
        # all_images.extend(page_images)

        for row in _get_rows(page, language=language):
            toks = [(w['x0'], w['text']) for w in row['words']]
            if not toks:
                continue

            row_text = ' '.join(t for _, t in toks)

            # Skip footer / instruction lines
            if FOOTER_RE.match(row_text) or _is_instruction_block(row_text):
                continue

            # Detect question number in left margin (up to NUM_COL_X)
            left_nums = [t for t in toks if t[0] < NUM_COL_X and QNUM_RE.match(t[1])]
            rest = [t for t in toks if t not in left_nums]

            # Filter rest to exclude marks-column contamination
            content_toks = [t for t in rest if t[0] < MARKS_ZONE_X]

            row_qnum = None
            if left_nums:
                candidate = left_nums[-1][1]
                parts = candidate.split('.')
                # A bare header line has only a 2-part number and no content tokens
                is_bare_header = len(parts) == 2 and not content_toks
                # Even bare headers are tracked; they introduce sub-items
                row_qnum = candidate

            if row_qnum:
                current_q = row_qnum
                if current_q not in items:
                    items[current_q] = []
                    order.append(current_q)
                if content_toks:
                    text = ' '.join(t for _, t in content_toks).strip()
                    if text and not FOOTER_RE.match(text):
                        items[current_q].append(text)
            elif current_q is not None:
                # Continuation row for current item
                # Check if this is a section break or references a future question number
                text = ' '.join(t[1] for t in toks if t[0] < MARKS_ZONE_X).strip()

                # Detect text that references a future question number (e.g. "1.3.1 to 1.3.3")
                future_qn = re.search(r'(\d+\.\d+(?:\.\d+)?)\s+to\s+(\d+\.\d+(?:\.\d+)?)', text)
                if future_qn:
                    # This is an instruction for a future section — don't append
                    pass
                elif SECTION_BREAK_RE.search(text) and len(text) > 20:
                    pass
                elif text and not FOOTER_RE.match(text) and not _is_instruction_block(text):
                    items[current_q].append(text)

    doc.close()

    # ------------------------------------------------------------------
    # Post-process: build result items
    # ------------------------------------------------------------------
    result = []
    for q in order:
        raw_segments = items[q]
        raw_text = ' '.join(raw_segments).strip()
        raw_text = re.sub(r'\s+', ' ', raw_text).strip()

        # Apply bilingual cleaner as final safety net
        raw_text = extract_english_from_bilingual(raw_text)

        parts = q.split('.')
        depth = len(parts)
        is_header = 1 if depth == 2 else 0
        header_level = depth

        # Keep headers even if they have no content (they introduce sub-items)
        # But skip empty non-headers
        if not raw_text and not is_header:
            continue

        # Detect MCQ options with stricter logic

        # Detect MCQ options with stricter logic
        clean_text, mcq_options = _extract_mcq_options(raw_text)
        is_mcq = 1 if mcq_options else 0
        item_answer_json = None

        if mcq_options:
            item_answer_json = json.dumps({
                'options': mcq_options,
                'type': 'mcq_single'
            })

        # Associate images with this item by vertical proximity on same page
        # (Simple heuristic: images on pages where this item appears)
        item_images = []  # Images handled by attachment_parser.py

        result.append({
            'question_number': q,
            'question_text': clean_text,
            'raw_text': raw_text,
            'is_header': is_header,
            'header_level': header_level,
            'is_mcq': is_mcq,
            'mcq_options': json.dumps(mcq_options) if mcq_options else None,
            'item_answer_json': item_answer_json,
            'qp_images': item_images,
            'marks': None
        })

    return result


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        items = extract_qp_content(sys.argv[1])
        print(json.dumps(items, indent=2, default=str))
