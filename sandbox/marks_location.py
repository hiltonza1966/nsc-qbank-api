#!/usr/bin/env python3
"""
Marks Location Diagnostic - Finds exact position of marks relative to question
Usage: python marks_location.py <pdf_path>
"""

import sys
import fitz
import re

if len(sys.argv) < 2:
    print("Usage: python marks_location.py <pdf_path>")
    sys.exit(1)

doc = fitz.open(sys.argv[1])

QUESTION_RE = re.compile(r'^\s*(\d+(?:\.\d+){1,3})\b')
MARKS_RE = re.compile(r'\((\d{1,2})\)')

print("=" * 80)
print("MARKS LOCATION DIAGNOSTIC")
print("=" * 80)

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

        # Search for marks in next 10 lines and show exact location
        print(f"\n{qnum}:")
        for j in range(i, min(i+10, len(lines))):
            line_text = lines[j].strip()
            marks_found = MARKS_RE.findall(line_text)
            if marks_found:
                print(f"  Line {j-i} (offset {j-i}): {line_text[:80]} -> marks: {marks_found}")
            elif j == i:
                print(f"  Line 0 (question): {line_text[:80]}")

doc.close()
