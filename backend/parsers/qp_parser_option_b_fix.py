#!/usr/bin/env python3
"""QP Parser Option B - Hybrid X.Y + X.Y.Z format.
Handles: Physical Sciences, Mathematics, Technical Sciences, Technical Mathematics.
FIX: Improved text extraction - captures text even when question number and text
are on separate lines or have minimal whitespace.
"""

import re
from PyPDF2 import PdfReader
from bilingual_cleaner import extract_english_from_bilingual

def extract_qp_items_option_b(pdf_path):
    reader = PdfReader(pdf_path)
    page_texts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            page_texts.append(text)

    all_text = extract_english_from_bilingual('\n'.join(page_texts))
    items = []

    # FIX: More flexible pattern that handles:
    # - Question number followed by space then text
    # - Question number on its own line, text on next line
    # - Question number followed by tab or multiple spaces
    # Pattern: number + optional whitespace + text until next number or end
    pattern = r'(\d+\.\d+(?:\.\d+)?)\s*(.*?)(?=(?:\d+\.\d+(?:\.\d+)?)|\Z)'
    all_matches = list(re.finditer(pattern, all_text, re.DOTALL))

    print(f"  [QP Parser] Found {len(all_matches)} raw matches")

    parents = set()
    for i, match in enumerate(all_matches):
        q_num = match.group(1)
        if len(q_num.split('.')) == 2:
            for j in range(i+1, min(i+8, len(all_matches))):
                child_num = all_matches[j].group(1)
                if child_num.startswith(q_num + '.'):
                    parents.add(q_num)
                    break

    for match in all_matches:
        q_num = match.group(1)
        content = match.group(2).strip()

        if q_num in parents:
            continue

        # Clean up whitespace
        content = re.sub(r'\s+', ' ', content)

        # Skip if content is just a number (likely a page number or artifact)
        if re.match(r'^\d+$', content):
            continue

        marks = 0

        # Look for marks in the content
        mark_matches = re.findall(r'\((\d+)\)(?!\s*x)', content)
        if mark_matches:
            marks = int(mark_matches[-1])

        # Check for section marks like (2 x 3) = 6 marks
        section_mark = re.search(r'\((\d+)\s*x\s*(\d+)\)', content)
        if section_mark and marks == 0:
            marks = int(section_mark.group(2))

        # Look for marks at the end of the content
        end_mark = re.search(r'(\d+)\s*marks?\s*$', content, re.IGNORECASE)
        if end_mark and marks == 0:
            marks = int(end_mark.group(1))

        # Look for marks in square brackets [N] at end
        bracket_mark = re.search(r'\[(\d+)\]\s*$', content)
        if bracket_mark and marks == 0:
            marks = int(bracket_mark.group(1))

        # Clean text: remove marks notation, section totals
        text_clean = re.sub(r'\(\d+\)\s*$', '', content)
        text_clean = re.sub(r'\[\d+\]', '', text_clean)
        text_clean = re.sub(r'\(\d+\s*x\s*\d+\)', '', text_clean)
        text_clean = re.sub(r'\d+\s*marks?\s*$', '', text_clean, flags=re.IGNORECASE)
        text_clean = text_clean.strip()

        # FIX: If text is very short, try to get more context from the raw match
        if len(text_clean) < 10:
            # Try to extract more text by looking at the raw content before cleaning
            raw_content = match.group(2).strip()
            # Remove only the marks patterns, keep everything else
            raw_clean = re.sub(r'\(\d+\)\s*$', '', raw_content)
            raw_clean = re.sub(r'\[\d+\]\s*$', '', raw_clean)
            raw_clean = re.sub(r'\d+\s*marks?\s*$', '', raw_clean, flags=re.IGNORECASE)
            raw_clean = raw_clean.strip()
            if len(raw_clean) > len(text_clean):
                text_clean = raw_clean

        # Fix short text by combining with parent
        if len(text_clean) < 5 and q_num.count('.') == 2:
            parent_num = '.'.join(q_num.split('.')[:2])
            for m in all_matches:
                if m.group(1) == parent_num:
                    parent_text = re.sub(r'\s+', ' ', m.group(2).strip())
                    parent_text = re.sub(r'\(\d+\)\s*$', '', parent_text)
                    parent_text = re.sub(r'\[\d+\]', '', parent_text).strip()
                    if parent_text and len(parent_text) > len(text_clean):
                        text_clean = f"{parent_text} - {text_clean}" if text_clean else parent_text
                    break

        # Skip items with no text and no marks (likely artifacts)
        if len(text_clean) < 3 and marks == 0:
            continue

        # FIX: Keep items that have marks even if text is short (memo will provide answer)
        # But log a warning for debugging
        if len(text_clean) < 5 and marks > 0:
            print(f"  [QP Parser] Warning: Q{q_num} has {marks} marks but short text: '{text_clean[:50]}'")

        format_type = 'X.Y.Z' if len(q_num.split('.')) == 3 else 'X.Y'

        items.append({
            'question_number': q_num,
            'question_text': text_clean[:500],  # Increased from 300 to 500
            'marks': marks,
            'source': 'qp',
            'format': format_type
        })

    best_items = {}
    for item in items:
        q_num = item['question_number']
        if q_num not in best_items:
            best_items[q_num] = item
        else:
            existing = best_items[q_num]
            if item['marks'] > existing['marks']:
                best_items[q_num] = item
            elif item['marks'] == existing['marks'] and len(item['question_text']) > len(existing['question_text']):
                best_items[q_num] = item

    result = list(best_items.values())
    print(f"  [QP Parser] Returning {len(result)} items")
    for item in result[:3]:
        print(f"    Q{item['question_number']}: {item['marks']} marks - text: '{item['question_text'][:60]}'")
    return result
