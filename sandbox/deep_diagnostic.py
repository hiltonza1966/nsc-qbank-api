#!/usr/bin/env python3
"""
Deep Diagnostic - Analyzes section structure, marks placement, and parent-child relationships
Usage: python deep_diagnostic.py <pdf_path>
"""

import sys
import fitz
import re

if len(sys.argv) < 2:
    print("Usage: python deep_diagnostic.py <pdf_path>")
    sys.exit(1)

doc = fitz.open(sys.argv[1])

QUESTION_RE = re.compile(r'^\s*(\d+(?:\.\d+){1,3})\b')
SECTION_RE = re.compile(r'^\s*QUESTION\s+(\d+)\s*\((\d+)\)', re.IGNORECASE)
MARKS_RE = re.compile(r'\((\d{1,2})\)')

print("=" * 80)
print("DEEP DIAGNOSTIC - Section Structure & Marks Placement")
print("=" * 80)

current_section = None
section_total = 0
questions_in_section = []

for page in doc:
    lines = page.get_text("text").split('\n')

    for i, line in enumerate(lines):
        # Check for section header
        section_match = SECTION_RE.match(line)
        if section_match:
            # Print previous section summary
            if current_section and questions_in_section:
                print(f"\n--- Section {current_section} Summary ---")
                print(f"  Section total: {section_total}")
                print(f"  Questions found: {len(questions_in_section)}")
                print(f"  Marks sum: {sum(q['marks'] for q in questions_in_section)}")
                for q in questions_in_section[:5]:
                    print(f"    {q['number']}: marks={q['marks']}")

            current_section = section_match.group(1)
            section_total = int(section_match.group(2))
            questions_in_section = []
            print(f"\n{'='*60}")
            print(f"SECTION {current_section} (Total: {section_total})")
            print(f"{'='*60}")
            continue

        # Check for question
        m = QUESTION_RE.match(line)
        if not m:
            continue

        qnum = m.group(1)
        parts = qnum.split('.')

        # Skip parent headers (2-part)
        if len(parts) == 2:
            continue

        # Find marks in context
        context = ' '.join(lines[i:i+6])[:200]
        marks = 0
        mm = MARKS_RE.search(context)
        if mm and mm.start() < 100:
            val = int(mm.group(1))
            if val <= 25:
                marks = val

        # Check if marks are on the same line or next line
        same_line = bool(re.search(r'\(\d+\)', line))
        next_line = False
        if i+1 < len(lines):
            next_line = bool(re.search(r'^\s*\(\d+\)', lines[i+1]))

        question_data = {
            'number': qnum,
            'marks': marks,
            'same_line': same_line,
            'next_line': next_line,
            'text': re.sub(r'^\s*\d+(?:\.\d+)+\s*', '', line)[:80]
        }
        questions_in_section.append(question_data)

        print(f"{qnum}: marks={marks} (same_line={same_line}, next_line={next_line}) | {question_data['text']}")

doc.close()

# Print final section summary
if current_section and questions_in_section:
    print(f"\n--- Section {current_section} Summary ---")
    print(f"  Section total: {section_total}")
    print(f"  Questions found: {len(questions_in_section)}")
    print(f"  Marks sum: {sum(q['marks'] for q in questions_in_section)}")
