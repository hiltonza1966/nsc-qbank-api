#!/usr/bin/env python3
"""
DBE Paper Extractor v13 - Corporate QBank System
Based on page_structure diagnostic findings:
- Marks are on separate lines from questions (offset 1-5 lines)
- Section totals (X x Y) are at end of sections, NOT individual marks
- Matching/MCQ questions have marks ONLY in memo
- Questions span multiple lines, need proper text capture
- Must search across page boundaries

Usage: python extract_dbe_paper.py <pdf_path> <mode> [paper_code]
"""

import sys
import json
import hashlib
import re

try:
    import fitz
except ImportError:
    print(json.dumps({"error": "PyMuPDF not installed"}))
    sys.exit(1)

# Regex patterns
QUESTION_RE = re.compile(r'^\s*(\d+(?:\.\d+){1,3})\b')
MARKS_RE = re.compile(r'\((\d{1,2})\)')
SECTION_MARKS_RE = re.compile(r'\((\d+)\s*x\s*(\d+)\)')
SECTION_HEADER_RE = re.compile(r'^\s*QUESTION\s+(\d+)\s*\((\d+)\)', re.IGNORECASE)

def parse_pdf(path, is_memo=False):
    """
    Parse PDF and extract questions with marks.

    Args:
        path: Path to PDF file
        is_memo: True if parsing marking guideline, False if parsing question paper

    Returns:
        (items_list, file_hash)
    """
    doc = fitz.open(path)
    file_hash = hashlib.md5(open(path, 'rb').read()).hexdigest()

    # First pass: collect all lines with page info
    all_lines = []
    for page in doc:
        page_lines = page.get_text("text").split('\n')
        for line in page_lines:
            all_lines.append({
                'text': line,
                'page': page.number + 1
            })

    results = {}
    current_section = None
    section_total = 0

    for i, line_data in enumerate(all_lines):
        line = line_data['text']
        page_num = line_data['page']

        # Check for section header
        section_match = SECTION_HEADER_RE.match(line)
        if section_match:
            current_section = section_match.group(1)
            section_total = int(section_match.group(2))
            continue

        # Check for question number
        m = QUESTION_RE.match(line)
        if not m:
            continue

        qnum = m.group(1)
        parts = qnum.split('.')

        # Skip parent headers (2-part numbers like 1.1, 2.4)
        if len(parts) == 2:
            continue

        # Deduplication: skip if already have this question with text
        if qnum in results and len(results[qnum]['question_text']) > 15:
            continue

        # Extract question text from current and next lines
        text_lines = []
        current_text = re.sub(r'^\s*\d+(?:\.\d+)+\s*', '', line).strip()

        # Skip lines that are just marks notation
        if current_text and not re.match(r'^\(\d+', current_text):
            text_lines.append(current_text)

        # Capture next lines as question text (until next question or empty line after text)
        j = i + 1
        while j < len(all_lines) and j < i + 10:
            next_line = all_lines[j]['text'].strip()

            # Stop at next question
            if QUESTION_RE.match(next_line):
                break

            # Stop at empty line after we have text
            if not next_line and len(text_lines) > 0:
                break

            # Skip lines that are just marks notation like (2), (1 x 2)
            if re.match(r'^\(\d+', next_line):
                j += 1
                continue

            # Skip memo answer lines (A/B/C/D/Y/Z with marks)
            if is_memo and re.match(r'^[A-DYZ]\s*\(\d+\)', next_line):
                j += 1
                continue

            # Add text line
            if next_line:
                text_lines.append(next_line)

            j += 1

        qtext = ' '.join(text_lines)

        # Extract marks - search wider context (up to 15 lines ahead)
        context_lines = []
        for j in range(i, min(i + 15, len(all_lines))):
            context_lines.append(all_lines[j]['text'])

        context = ' '.join(context_lines)[:500]
        marks = 0

        # Find all marks patterns in context
        all_marks = list(MARKS_RE.finditer(context))
        for mm in all_marks:
            if mm.start() < 400:
                val = int(mm.group(1))
                # Individual marks are 1-15 (section totals are 20-40)
                if 1 <= val <= 15 and val > marks:
                    marks = val

        # Check for section marks format (X x Y) - these are section totals
        section_marks_match = SECTION_MARKS_RE.search(context)
        if section_marks_match and section_marks_match.start() < 400:
            factor = int(section_marks_match.group(1))
            unit = int(section_marks_match.group(2))
            total = factor * unit
            # Only use if it's a reasonable individual mark (1-15)
            # AND the factor is small (not a section total like 8x1)
            if 1 <= total <= 15 and factor <= 5 and total > marks:
                marks = total

        # Clean text - remove marks notation from end
        qtext = re.sub(r'\s*\(\d+\s*x\s*\d+\)\s*$', '', qtext)
        qtext = re.sub(r'\s*\(\d+\)\s*$', '', qtext).strip()

        # Extract answer text for memo
        answer = ''
        if is_memo:
            buf = []
            j = i + 1
            while j < len(all_lines) and not QUESTION_RE.match(all_lines[j]['text']) and len(buf) < 12:
                next_line = all_lines[j]['text'].strip()
                if next_line:
                    buf.append(next_line)
                j += 1
            answer = ' '.join(buf)

        results[qnum] = {
            'question_number': qnum,
            'question_text': qtext[:500],
            'parser_extracted_marks': marks,
            'answer_text': answer[:500] if is_memo else '',
            'page': page_num
        }

    doc.close()
    return list(results.values()), file_hash


def compare_qp_memo(qp_items, mg_items):
    """
    Compare QP and Memo items, identify mismatches.

    Args:
        qp_items: Dict of QP items by question_number
        mg_items: Dict of Memo items by question_number

    Returns:
        List of comparison results with red flags
    """
    red_flags = []
    all_keys = sorted(
        set(qp_items.keys()) | set(mg_items.keys()),
        key=lambda x: [int(p) for p in x.split('.')]
    )

    for key in all_keys:
        qp = qp_items.get(key, {})
        mg = mg_items.get(key, {})

        qp_marks = qp.get('parser_extracted_marks', 0) or 0
        mg_marks = mg.get('parser_extracted_marks', 0) or 0

        # Use memo marks as source of truth, QP as fallback
        final_marks = mg_marks if mg_marks > 0 else qp_marks

        variance = qp_marks - mg_marks

        # Red flag logic:
        # - Both have marks but they differ (real mismatch)
        # - No question text or no answer text (missing data)
        # - NOT flagged when QP has 0 but memo has marks (normal for matching/MCQ)
        is_red = (
            (qp_marks > 0 and mg_marks > 0 and qp_marks != mg_marks) or
            not qp.get('question_text') or
            not mg.get('answer_text')
        )

        red_flags.append({
            'question_number': key,
            'qp_text': qp.get('question_text', '')[:120],
            'mg_text': mg.get('answer_text', '')[:120],
            'qp_marks': qp_marks,
            'mg_marks': mg_marks,
            'final_marks': final_marks,
            'variance': variance,
            'is_red_flag': is_red,
            'qp_page': qp.get('page'),
            'mg_page': mg.get('page')
        })

    return red_flags


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({
            "error": "Usage: extract_dbe_paper.py <pdf_path> <mode> [paper_code]"
        }))
        sys.exit(1)

    pdf_path = sys.argv[1]
    mode = sys.argv[2]
    paper_code = sys.argv[3] if len(sys.argv) > 3 else ''

    try:
        is_memo = (mode == 'memo')
        items_list, file_hash = parse_pdf(pdf_path, is_memo=is_memo)

        result = {
            'paper_code': paper_code,
            'items': items_list,
            'total_items': len(items_list),
            'total_marks': sum(item['parser_extracted_marks'] for item in items_list),
            'file_hash': file_hash[:8]
        }

        print(json.dumps(result))
    except Exception as e:
        import traceback
        print(json.dumps({
            'error': str(e),
            'traceback': traceback.format_exc()
        }))
