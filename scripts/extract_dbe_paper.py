#!/usr/bin/env python3
"""
DBE Paper Extractor - Corporate QBank System
Uses PyMuPDF (fitz) for layout-aware PDF extraction.
NO REGEX - uses only string methods for parsing.
"""

import sys
import json

try:
    import fitz  # PyMuPDF
except ImportError:
    print(json.dumps({"error": "PyMuPDF not installed. Run: pip install PyMuPDF"}))
    sys.exit(1)


def extract_question_number(text):
    """Extract question number from start of text. Returns (qnum, rest) or (None, None)."""
    text = text.strip()
    if not text:
        return None, None

    tokens = text.split(None, 1)
    first_token = tokens[0] if tokens else ''
    clean = first_token.rstrip('.).,;')
    parts = clean.split('.')

    if len(parts) < 2 or len(parts) > 3:
        return None, None

    if not all(p.isdigit() for p in parts):
        return None, None

    qnum = '.'.join(parts)
    rest_start = len(first_token)
    while rest_start < len(text) and text[rest_start].isspace():
        rest_start += 1
    rest = text[rest_start:].strip()

    if rest.startswith('.') or rest.startswith(')'):
        rest = rest[1:].strip()

    return qnum, rest


def is_section_header(text):
    text = text.strip().upper()
    return text.startswith('SECTION ') and len(text) > 8 and text[8:9].isalpha()


def is_question_header(text):
    text = text.strip().upper()
    return text.startswith('QUESTION ') and len(text) > 9


def is_subsection_header(text):
    text = text.strip()
    tokens = text.split(None, 1)
    if not tokens:
        return False
    first = tokens[0]
    clean = first.rstrip('.).,;')
    subparts = clean.split('.')
    if len(subparts) == 2 and subparts[0].isdigit() and subparts[1].isdigit():
        if len(tokens) > 1:
            rest = tokens[1].strip()
            if rest and rest[0].isupper():
                return True
    return False


def is_batch_marks(text):
    text = text.strip()
    if not text.startswith('('):
        return False
    close = text.find(')')
    if close == -1:
        return False
    inner = text[1:close].strip()
    if 'x' not in inner:
        return False
    x_pos = inner.find('x')
    left = inner[:x_pos].strip()
    right = inner[x_pos + 1:].strip()
    return left.isdigit() and right.isdigit()


def is_section_total(text):
    text = text.strip()
    if not text.startswith('['):
        return False
    close = text.find(']')
    if close == -1:
        return False
    inner = text[1:close].strip()
    return inner.isdigit()


def is_page_metadata(text):
    text = text.strip()
    return text.startswith('DBE/') or 'Copyright' in text or text.startswith('Please turn over')


def is_instruction(text):
    text = text.strip().upper()
    return 'INSTRUCTION' in text


def extract_marks_qp(text):
    """Extract marks from FIRST LINE only - avoids section totals."""
    lines = text.strip().split("\n")
    first_line = lines[0] if lines else text
    marks = 0

    idx = 0
    while idx < len(first_line):
        open_idx = first_line.find("(", idx)
        if open_idx == -1:
            break
        close_idx = first_line.find(")", open_idx)
        if close_idx == -1:
            break
        inner = first_line[open_idx + 1:close_idx].strip()
        if "x" in inner:
            x_pos = inner.find("x")
            left = inner[:x_pos].strip()
            right = inner[x_pos + 1:].strip()
            if left.isdigit() and right.isdigit():
                val = int(left) * int(right)
                if val <= 25 and val > marks:
                    marks = val
        elif inner.isdigit():
            val = int(inner)
            if val <= 25 and val > marks:
                marks = val
        idx = close_idx + 1

    return marks
def extract_marks_memo(text):
    """Extract marks for Memo - sums all individual mark points."""
    total = 0
    idx = 0
    while idx < len(text):
        open_idx = text.find('(', idx)
        if open_idx == -1:
            break
        close_idx = text.find(')', open_idx)
        if close_idx == -1:
            break

        inner = text[open_idx + 1:close_idx].strip()
        if inner.isdigit():
            val = int(inner)
            if val <= 5:
                total += val

        idx = close_idx + 1

    return total


def get_question_type(qnum):
    """Determine question type based on DBE conventions."""
    parts = qnum.split('.')
    if len(parts) == 3:
        parent = parts[0] + '.' + parts[1]
        if parent in ('1.1', '2.2'):
            return 'Matching'
        elif parent in ('1.2', '2.1'):
            return 'MCQ'
        elif parts[0] == '3':
            return 'Diagram'
        elif parent in ('1.3', '1.4', '1.5'):
            return 'Diagram'
    elif len(parts) == 2:
        if parts[0] == '1' and parts[1] in ('1', '2'):
            return 'Matching' if parts[1] == '1' else 'MCQ'
        elif parts[0] == '2' and parts[1] in ('1', '2'):
            return 'MCQ' if parts[1] == '1' else 'Matching'
        elif parts[0] == '3':
            return 'Diagram'
    return 'Extended'


def classify_line(text):
    """Classify a line of text from a DBE paper."""
    if not text or not text.strip():
        return 'empty'

    if is_section_header(text):
        return 'section_header'

    if is_question_header(text):
        return 'question_header'

    if is_subsection_header(text):
        return 'subsection_header'

    if is_batch_marks(text):
        return 'batch_marks'

    if is_section_total(text):
        return 'section_total'

    if is_page_metadata(text):
        return 'page_metadata'

    if is_instruction(text):
        return 'instruction'

    qnum, rest = extract_question_number(text)
    if qnum:
        parts = qnum.split('.')
        if len(parts) == 3:
            return 'question_item'
        elif len(parts) == 2:
            return 'parent_question'

    return 'body_text'


def extract_qp(pdf_path):
    """Extract question paper items from a DBE PDF."""
    doc = fitz.open(pdf_path)
    lines = []

    for page_num, page in enumerate(doc, 1):
        blocks = page.get_text("dict")["blocks"]
        for block in blocks:
            if "lines" not in block:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    if not text:
                        continue
                    lines.append({
                        "text": text,
                        "font": span.get("font", ""),
                        "size": span.get("size", 0),
                        "flags": span.get("flags", 0),
                        "page": page_num
                    })

    for line in lines:
        line["type"] = classify_line(line["text"])

    questions = []
    current_section = 'Section A'
    current_question = None
    current_block_lines = []

    for line in lines:
        ltype = line["type"]
        text = line["text"]

        if ltype == 'section_header':
            parts = text.strip().upper().split()
            if len(parts) > 1:
                current_section = 'Section ' + parts[1]
            continue

        if ltype == 'question_header':
            parts = text.strip().upper().split()
            if len(parts) > 1:
                q_num_str = parts[1]
                if q_num_str.isdigit():
                    q_num = int(q_num_str)
                    if q_num == 2:
                        current_section = 'Section B'
                    elif q_num == 3:
                        current_section = 'Section C'
            continue

        if ltype == 'question_item':
            if current_question:
                block_text = ' '.join(l["text"] for l in current_block_lines)
                marks = extract_marks_qp(block_text)
                questions.append({
                    "number": current_question["number"],
                    "text": current_question["text"],
                    "section": current_section,
                    "type": get_question_type(current_question["number"]),
                    "marks": marks,
                    "page": current_question["page"]
                })

            qnum, rest = extract_question_number(text)
            current_question = {
                "number": qnum,
                "text": rest,
                "page": line["page"]
            }
            current_block_lines = [line]

        elif ltype in ('body_text', 'batch_marks', 'section_total', 'parent_question', 'subsection_header'):
            if current_question:
                current_block_lines.append(line)

    if current_question:
        block_text = ' '.join(l["text"] for l in current_block_lines)
        marks = extract_marks_qp(block_text)
        questions.append({
            "number": current_question["number"],
            "text": current_question["text"],
            "section": current_section,
            "type": get_question_type(current_question["number"]),
            "marks": marks,
            "page": current_question["page"]
        })

    doc.close()

    total_marks = sum(q["marks"] for q in questions)
    return {
        "items": questions,
        "total_items": len(questions),
        "total_marks": total_marks
    }


def clean_memo_text(text):
    """Clean memo answer text by removing rubric indicators and marks notations."""
    clean = text

    # Remove rubric indicators
    rubrics = ['[ANY ONE]', '[ANY TWO]', '[ANY THREE]', '[ANY FOUR]', '[CONCEPT]',
               '[ANY ONE', '[ANY TWO', '[ANY THREE', '[ANY FOUR']
    for rubric in rubrics:
        clean = clean.replace(rubric, '')

    clean = clean.replace('INSTRUCTIONS FOR PART MARKING', '')

    # Remove batch marks notations
    batch_patterns = ['(1x 1)', '(1x 2)', '(2x 2)', '(3x 2)', '(4x 2)', '(4x 1)',
                      '(8x 1)', '(7x 1)', '(3x 2)', '(2x 2)', '(1x 1)']
    for bp in batch_patterns:
        clean = clean.replace(bp, '')

    # Remove individual marks (digits in parentheses where value <= 5)
    result = []
    i = 0
    while i < len(clean):
        open_idx = clean.find('(', i)
        if open_idx == -1:
            result.append(clean[i:])
            break
        close_idx = clean.find(')', open_idx)
        if close_idx == -1:
            result.append(clean[i:])
            break

        inner = clean[open_idx + 1:close_idx].strip()
        if inner.isdigit() and int(inner) <= 5:
            result.append(clean[i:open_idx])
            i = close_idx + 1
        else:
            result.append(clean[i:open_idx + 1])
            i = open_idx + 1

    clean = ''.join(result)

    # Remove bracket marks
    result = []
    i = 0
    while i < len(clean):
        open_idx = clean.find('[', i)
        if open_idx == -1:
            result.append(clean[i:])
            break
        close_idx = clean.find(']', open_idx)
        if close_idx == -1:
            result.append(clean[i:])
            break

        inner = clean[open_idx + 1:close_idx].strip()
        if inner.isdigit():
            result.append(clean[i:open_idx])
            i = close_idx + 1
        else:
            result.append(clean[i:open_idx + 1])
            i = open_idx + 1

    clean = ''.join(result)

    # Remove "marks" text
    clean = clean.replace('marks', '').replace('MARKS', '')

    return clean.strip()


def extract_memo(pdf_path):
    """Extract memo items from a DBE marking guideline PDF."""
    doc = fitz.open(pdf_path)
    lines = []

    for page_num, page in enumerate(doc, 1):
        blocks = page.get_text("dict")["blocks"]
        for block in blocks:
            if "lines" not in block:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    if not text:
                        continue
                    lines.append({
                        "text": text,
                        "page": page_num
                    })

    items = []
    current_question = None
    current_lines = []

    for line in lines:
        text = line["text"].strip()
        if not text:
            continue

        qnum, rest = extract_question_number(text)
        if qnum:
            if qnum == current_question:
                # Same question number - append text to current item
                if rest:
                    current_lines.append(rest)
            else:
                # New question number - save previous, start new
                if current_question:
                    block_text = " ".join(current_lines)
                    marks = extract_marks_memo(block_text)
                    clean = clean_memo_text(block_text)
                    # Skip items with only single letters (answer choices)
                    if len(clean.strip()) > 3 or not clean.strip().isalpha():
                        items.append({
                            "number": current_question,
                            "text": clean,
                            "marks": marks
                        })
                current_question = qnum
                current_lines = [rest] if rest else []
            continue
        else:
            # Not a question number line - add to current item
            if current_question:
                current_lines.append(text)

    # Save last question
    if current_question:
        block_text = " ".join(current_lines)
        marks = extract_marks_memo(block_text)
        clean = clean_memo_text(block_text)
        # Skip items with only single letters (answer choices)
        if len(clean.strip()) > 3 or not clean.strip().isalpha():
            items.append({
                "number": current_question,
                "text": clean,
                "marks": marks
            })

    doc.close()

    total_marks = sum(i["marks"] for i in items)
    return {
        "items": items,
        "total_items": len(items),
        "total_marks": total_marks
    }


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: extract_dbe_paper.py <pdf_path> <mode> [paper_code]"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    mode = sys.argv[2]
    paper_code = sys.argv[3] if len(sys.argv) > 3 else ''

    try:
        if mode == 'qp':
            result = extract_qp(pdf_path)
        elif mode == 'memo':
            result = extract_memo(pdf_path)
        else:
            result = {"error": "Mode must be 'qp' or 'memo'"}

        result["paper_code"] = paper_code
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))