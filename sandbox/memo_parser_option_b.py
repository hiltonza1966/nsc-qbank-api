#!/usr/bin/env python3
"""Option B Memo Parser - For Accounting/Business Studies-style DBE papers
Handles: X.Y numbering, table-based memos, [X] marks, √ ticks, calculations
"""
import re
from PyPDF2 import PdfReader

def extract_memo_items_option_b(pdf_path):
    reader = PdfReader(pdf_path)

    all_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            all_text += text + "\n"

    items = []

    # Pattern 1: Standard X.Y questions (e.g., 1.1, 1.2, 2.1)
    q_pattern_xy = r'(\d+\.\d+)\s+(.*?)(?=\d+\.\d+|\Z)'
    matches_xy = list(re.finditer(q_pattern_xy, all_text, re.DOTALL))

    # Pattern 2: X.Y.Z sub-questions (e.g., 1.1.1, 2.3.1)
    q_pattern_xyz = r'(\d+\.\d+\.\d+)\s+(.*?)(?=\d+\.\d+\.\d+|\Z)'
    matches_xyz = list(re.finditer(q_pattern_xyz, all_text, re.DOTALL))

    # Use whichever pattern finds more items
    matches = matches_xyz if len(matches_xyz) > len(matches_xy) else matches_xy

    for match in matches:
        q_num = match.group(1)
        content = match.group(2).strip()

        content = re.sub(r'\s+', ' ', content)
        content = re.sub(r'Please turn over', '', content)
        content = re.sub(r'Copyright reserved', '', content)

        # Extract marks from various formats
        # Format 1: [X] marks (e.g., [6], [8])
        bracket_marks = re.findall(r'\[(\d+)\]', content)

        # Format 2: √ ticks (each tick = 1 mark)
        ticks = content.count('√') + content.count('✓') + content.count('')

        # Format 3: Inline (X) marks
        inline_marks = re.findall(r'\((\d+)\)', content)

        # Format 4: Table cell marks (e.g., "6" in last column)
        # Look for numbers at end of lines after table content
        table_marks = re.findall(r'\n\s*(\d+)\s*\n', content)

        # Determine mark
        mark = 0
        if bracket_marks:
            mark = int(bracket_marks[-1])
        elif inline_marks:
            mark = int(inline_marks[-1])
        elif ticks > 0 and ticks <= 15:
            mark = ticks
        elif table_marks:
            # Filter reasonable values
            valid_table = [int(m) for m in table_marks if 1 <= int(m) <= 15]
            if valid_table:
                mark = max(valid_table)

        # Clean answer text
        answer_text = content
        answer_text = re.sub(r'\[(\d+)\]', '', answer_text)
        answer_text = re.sub(r'\((\d+)\)', '', answer_text)
        answer_text = re.sub(r'[√✓]', '', answer_text)
        answer_text = re.sub(r'\s+', ' ', answer_text).strip()

        # Extract calculation/working if present
        workings = re.findall(r'WORKINGS.*?ANSWER', answer_text, re.DOTALL)
        if workings:
            answer_text = workings[0]

        items.append({
            'question_number': q_num,
            'answer_text': answer_text[:500],
            'marks': mark,
            'bracket_marks': bracket_marks,
            'ticks': ticks,
            'inline_marks': inline_marks,
            'source': 'memo'
        })

    # Deduplicate
    best_items = {}
    for item in items:
        q_num = item['question_number']
        if q_num not in best_items or item['marks'] > best_items[q_num]['marks']:
            best_items[q_num] = item

    return list(best_items.values())
