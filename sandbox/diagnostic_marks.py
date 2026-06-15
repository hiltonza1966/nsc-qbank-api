#!/usr/bin/env python3
"""
Marks Diagnostic - Shows all marks found per question
Usage: python diagnostic_marks.py <pdf_path>
"""

import sys
import fitz
import re

if len(sys.argv) < 2:
    print("Usage: python diagnostic_marks.py <pdf_path>")
    sys.exit(1)

doc = fitz.open(sys.argv[1])

QUESTION_RE = re.compile(r'^\s*(\d+(?:\.\d+){1,3})\b')
MARKS_RE = re.compile(r'\((\d{1,2})\)')
MARKS_FACTOR_RE = re.compile(r'\((\d+)\s*x\s*(\d+)\)')

print("=" * 80)
print("MARKS DIAGNOSTIC - All marks found per question")
print("=" * 80)

total_marks_found = 0
for page in doc:
    lines = page.get_text("text").split('\n')

    for i, line in enumerate(lines):
        m = QUESTION_RE.match(line)
        if not m:
            continue

        qnum = m.group(1)
        parts = qnum.split('.')

        if len(parts) == 2:
            continue

        # Find all marks in extended context
        context = ' '.join(lines[i:i+8])[:300]

        all_marks = list(MARKS_RE.finditer(context))
        marks_list = []
        for mm in all_marks:
            if mm.start() < 200:
                val = int(mm.group(1))
                if val <= 25:
                    marks_list.append(val)

        mf = MARKS_FACTOR_RE.search(context)
        if mf and mf.start() < 200:
            factor = int(mf.group(1))
            unit = int(mf.group(2))
            total = factor * unit
            if total <= 25:
                marks_list.append(total)

        if marks_list:
            best_mark = max(marks_list)
            total_marks_found += best_mark
            print(f"{qnum}: marks={best_mark} (all found: {marks_list})")
        else:
            print(f"{qnum}: NO MARKS FOUND")

doc.close()
print(f"\nTotal marks found: {total_marks_found}")
print(f"Expected: ~150")
print(f"Missing: {150 - total_marks_found}")
