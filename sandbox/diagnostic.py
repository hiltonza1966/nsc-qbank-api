#!/usr/bin/env python3
"""
PDF Diagnostic Tool - Shows raw text around question numbers
Usage: python diagnostic.py <pdf_path>
"""

import sys
import fitz
import re

if len(sys.argv) < 2:
    print("Usage: python diagnostic.py <pdf_path>")
    sys.exit(1)

doc = fitz.open(sys.argv[1])

print("=" * 80)
print("PDF DIAGNOSTIC - First 20 question matches")
print("=" * 80)

count = 0
for page in doc:
    text = page.get_text("text")
    lines = text.split('\n')

    for i, line in enumerate(lines):
        m = re.match(r'^\s*(\d+(?:\.\d+){1,3})\b', line)
        if not m:
            continue

        qnum = m.group(1)
        parts = qnum.split('.')

        # Show context: current line + next 3 lines
        context = lines[i:i+4]

        print(f"\n--- Match {count+1}: {qnum} (parts={len(parts)}) ---")
        for j, ctx_line in enumerate(context):
            marker = ">>> " if j == 0 else "    "
            print(f"{marker}{ctx_line[:100]}")

        count += 1
        if count >= 20:
            break

    if count >= 20:
        break

doc.close()
print(f"\nTotal matches found: {count}")
