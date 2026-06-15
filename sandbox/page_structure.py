#!/usr/bin/env python3
"""
Page Structure Diagnostic - Shows full page layout with marks alignment
Usage: python page_structure.py <pdf_path>
"""

import sys
import fitz
import re

if len(sys.argv) < 2:
    print("Usage: python page_structure.py <pdf_path>")
    sys.exit(1)

doc = fitz.open(sys.argv[1])

QUESTION_RE = re.compile(r'^\s*(\d+(?:\.\d+){1,3})\b')
MARKS_RE = re.compile(r'\((\d{1,2})\)')
SECTION_MARKS_RE = re.compile(r'\((\d+)\s*x\s*(\d+)\)')

print("=" * 80)
print("PAGE STRUCTURE DIAGNOSTIC")
print("=" * 80)

for page_num, page in enumerate(doc, 1):
    text = page.get_text("text")
    lines = text.split('\n')

    print(f"\n--- PAGE {page_num} ---")
    print(f"Total lines: {len(lines)}")

    # Find all question numbers and marks on this page
    questions = []
    marks_list = []

    for i, line in enumerate(lines):
        q_match = QUESTION_RE.match(line)
        if q_match:
            qnum = q_match.group(1)
            parts = qnum.split('.')
            if len(parts) >= 3:  # Only sub-questions
                questions.append({
                    'number': qnum,
                    'line': i,
                    'text': line.strip()[:80]
                })

        # Check for marks patterns
        marks_found = MARKS_RE.findall(line)
        section_marks = SECTION_MARKS_RE.findall(line)

        if marks_found or section_marks:
            marks_list.append({
                'line': i,
                'text': line.strip()[:80],
                'marks': marks_found,
                'section_marks': section_marks
            })

    print(f"Questions found: {len(questions)}")
    print(f"Marks found: {len(marks_list)}")

    # Show questions and their nearby marks
    for q in questions[:5]:  # Show first 5 questions per page
        print(f"\n  {q['number']} (line {q['line']}):")
        print(f"    Text: {q['text']}")

        # Find marks within 5 lines after question
        nearby_marks = []
        for m in marks_list:
            if q['line'] <= m['line'] <= q['line'] + 5:
                nearby_marks.append(m)

        if nearby_marks:
            for m in nearby_marks:
                print(f"    Marks at line {m['line']}: {m['text']}")
        else:
            print(f"    No marks found nearby")

doc.close()
