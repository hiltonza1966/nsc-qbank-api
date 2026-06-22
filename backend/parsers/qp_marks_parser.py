#!/usr/bin/env python3
"""QP Marks Parser - PRIMARY marks source.
Extracts marks from QP PDF using multiple sources:
1. Mark allocation table (authoritative for main question totals)
2. Inline marks: 1.1 ... (6) - handles concatenated format
3. Question headers: QUESTION 1 (50 marks; 45 minutes)

For sub-questions without inline marks, marks must be inferred
or flagged for manual review.
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

    # === SOURCE 2: Inline marks ===
    # Handles formats like: "1.1Refer...shirts.(6)" or "1.1 ... (6)"
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
