#!/usr/bin/env python3
"""Memo Marks Parser - Extracts SECTION TOTALS only from Memo PDF.

IMPORTANT: The memo is designed for human markers, not automated parsing.
Per-sub-question marks in the memo are embedded in tables, part-marks,
and various formats that are ambiguous without human context.

This parser ONLY extracts section totals (e.g., Q1=50, Q2=45) for
validation against QP marks. Per-sub-question marks come from QP only.
"""

import re
import fitz
import json

try:
    from bilingual_cleaner import extract_english_from_bilingual
except ImportError:
    def extract_english_from_bilingual(text):
        return text


def extract_memo_marks(pdf_path):
    """Extract section totals from Memo PDF.

    Returns list of {question_number, marks, source} dicts.
    Only returns main question section totals (e.g., "1": 50, "2": 45).
    """
    doc = fitz.open(pdf_path)

    all_text = ""
    for page in doc:
        text = page.get_text()
        if text:
            all_text += text + "\n"

    all_text = extract_english_from_bilingual(all_text)
    doc.close()

    section_totals = {}
    lines = all_text.split('\n')

    # === STRATEGY: Find TOTALMARKS and associate with nearest QUESTION ===
    for i, line in enumerate(lines):
        if 'TOTALMARKS' in line.upper() or 'TOTAL MARKS' in line.upper():
            # Scan backwards for QUESTION number
            current_question = None
            for j in range(i-1, max(-1, i-100), -1):
                q_match = re.search(r'QUESTION\s+(\d+)', lines[j], re.IGNORECASE)
                if q_match:
                    current_question = q_match.group(1)
                    break
                sub_q_match = re.search(r'#\s*(\d+)\.\d+', lines[j])
                if sub_q_match:
                    current_question = sub_q_match.group(1)
                    break

            if current_question:
                # Look for mark value in surrounding lines
                for j in range(max(0, i-2), min(len(lines), i+10)):
                    val_match = re.search(r'\|\s*(\d+)\s*\|', lines[j])
                    if val_match:
                        val = int(val_match.group(1))
                        if 10 <= val <= 150:  # Reasonable section total
                            section_totals[current_question] = val
                            break
                    standalone_match = re.match(r'^\s*(\d{2,3})\s*$', lines[j])
                    if standalone_match:
                        val = int(standalone_match.group(1))
                        if 10 <= val <= 150:
                            section_totals[current_question] = val
                            break

    # Build result - only section totals
    result = []
    for q_num in sorted(section_totals.keys(), key=int):
        result.append({
            'question_number': q_num,
            'marks': section_totals[q_num],
            'source': 'memo_section_total'
        })

    return result


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        items = extract_memo_marks(sys.argv[1])
        print(json.dumps(items, indent=2))
