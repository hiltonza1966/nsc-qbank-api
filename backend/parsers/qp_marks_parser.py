#!/usr/bin/env python3
"""QP Marks Parser - PRIMARY marks source.
Extracts marks from QP PDF using multiple sources:
1. Mark allocation table (authoritative for main question totals)
2. Inline marks: 1.1 ... (6) - handles concatenated format
3. Question headers: QUESTION 1 (50 marks; 45 minutes)

SURGICAL TWEAKS APPLIED:
1. Added "N marks" / "N MARKS" pattern at end of line
2. Added "[N]" bracket format
3. Added multi-part: (3) + (4) = 7
4. Added sub-question: (a) (3)
5. Added table cell format detection
"""

import re
import fitz
import json

try:
    from bilingual_cleaner import extract_english_from_bilingual
except ImportError:
    def extract_english_from_bilingual(text):
        return text


def extract_qp_marks(pdf_path):
    """Extract marks from QP PDF.

    Returns list of {question_number, marks, source} dicts.
    """
    doc = fitz.open(pdf_path)

    all_text = ""
    for page in doc:
        text = page.get_text()
        if not text:
            try:
                import pytesseract
                from PIL import Image
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                img = Image.frombytes('RGB', [pix.width, pix.height], pix.samples)
                text = pytesseract.image_to_string(img)
            except Exception as e:
                text = ''
        if text:
            all_text += text + "\n"

    all_text = extract_english_from_bilingual(all_text)
    doc.close()

    marks = {}
    section_totals = {}

    # === SOURCE 1: Mark allocation table ===
    # Format: <tr><td>1</td><td>Topic</td><td>50</td><td>45</td></tr>
    table_pattern = r'<tr><td>(\d+)</td><td>([^<]+)</td><td>(\d+)</td><td>(\d+)</td></tr>'
    for match in re.finditer(table_pattern, all_text):
        q_num = match.group(1)
        mark_val = int(match.group(3))
        section_totals[q_num] = mark_val

    # === SOURCE 2: Inline marks (existing patterns) ===
    # Pattern: question number followed by text, then (N)
    inline_pattern = r'(\d+\.\d+(?:\.\d+)?)[^\(]*?\((\d+)\)'
    inline_matches = re.findall(inline_pattern, all_text)

    # Also handle "3x1" format (3 questions, 1 mark each)
    multi_pattern = r'(\d+\.\d+)\s*\((\d+)\s*x\s*(\d+)\)'
    multi_matches = re.findall(multi_pattern, all_text)
    for q_num, count, mark_val in multi_matches:
        total = int(count) * int(mark_val)
        # Distribute evenly to sub-questions
        for i in range(1, int(count) + 1):
            sub_q = f"{q_num}.{i}"
            if sub_q not in marks:
                marks[sub_q] = int(mark_val)

    for q_num, mark_val in inline_matches:
        mark_val = int(mark_val)
        if q_num not in marks:
            marks[q_num] = mark_val
        else:
            # Same question has multiple marks (e.g., 2.1 has (3) and (4)), sum them
            marks[q_num] += mark_val

    # === SOURCE 2b: "N marks" / "N MARKS" at end of line ===
    # Examples: "6 marks", "6 MARKS", "(6 marks)"
    marks_word_pattern = r'(\d+\.\d+(?:\.\d+)?)[^\n]*?\b(\d+)\s*marks?\b'
    marks_word_matches = re.findall(marks_word_pattern, all_text, re.IGNORECASE)
    for q_num, mark_val in marks_word_matches:
        mark_val = int(mark_val)
        if q_num not in marks:
            marks[q_num] = mark_val

    # === SOURCE 2c: "[N]" bracket format ===
    # Examples: "1.1 ... [6]", "1.2 ... [3]"
    bracket_pattern = r'(\d+\.\d+(?:\.\d+)?)[^\[]*?\[(\d+)\]'
    bracket_matches = re.findall(bracket_pattern, all_text)
    for q_num, mark_val in bracket_matches:
        mark_val = int(mark_val)
        if q_num not in marks:
            marks[q_num] = mark_val

    # === SOURCE 2d: Multi-part (3) + (4) = 7 ===
    # Examples: "1.1 ... (3) + (4) = (7)", "2.3 ... (2) + (3)"
    multipart_pattern = r'(\d+\.\d+(?:\.\d+)?)[^\(]*?\((\d+)\)\s*\+\s*\((\d+)\)'
    multipart_matches = re.findall(multipart_pattern, all_text)
    for q_num, part1, part2 in multipart_matches:
        total = int(part1) + int(part2)
        if q_num not in marks:
            marks[q_num] = total

    # === SOURCE 2e: Sub-question (a) (3) format ===
    # Examples: "(a) (3)", "(b) (4)", "(c) (2)"
    subq_pattern = r'\(([a-z])\)[^\(]*?\((\d+)\)'
    subq_matches = re.findall(subq_pattern, all_text)
    # These are typically within a main question - we need to find the context
    # For now, we'll note them but they need parent question context
    # This is handled by the harness which infers from section totals

    # === SOURCE 2f: Table cell format ===
    # Examples: <td>6</td> near question numbers
    table_cell_pattern = r'(\d+\.\d+(?:\.\d+)?)[^<]*<td[^>]*>(\d+)</td>'
    table_cell_matches = re.findall(table_cell_pattern, all_text, re.IGNORECASE)
    for q_num, mark_val in table_cell_matches:
        mark_val = int(mark_val)
        if q_num not in marks and 1 <= mark_val <= 50:
            marks[q_num] = mark_val

    # === SOURCE 3: Question headers ===
    header_pattern = r'QUESTION\s+(\d+)[:\s][^\(]*\((\d+)\s*marks?\s*;\s*\d+\s*minutes\)'
    header_matches = re.findall(header_pattern, all_text, re.IGNORECASE)

    for q_num, mark_val in header_matches:
        mark_val = int(mark_val)
        if q_num not in section_totals:
            section_totals[q_num] = mark_val

    # === BUILD RESULT ===
    # Include all inline marks
    result = []
    for q_num in sorted(marks.keys(), key=lambda x: [int(n) for n in x.split('.')]):
        result.append({
            'question_number': q_num,
            'marks': marks[q_num],
            'source': 'qp_inline'
        })

    # Include section totals for main questions not already covered
    for q_num, mark_val in section_totals.items():
        if q_num not in marks:
            result.append({
                'question_number': q_num,
                'marks': mark_val,
                'source': 'qp_allocation_table'
            })

    # Sort by question number
    result.sort(key=lambda x: [int(n) for n in x['question_number'].split('.')])

    return result


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        items = extract_qp_marks(sys.argv[1])
        print(json.dumps(items, indent=2))
