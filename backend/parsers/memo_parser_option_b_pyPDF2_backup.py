#!/usr/bin/env python3
"""Memo Parser Option B - Hybrid format for bilingual memos.
CRITICAL FIX for Technical Sciences: Handle bilingual ticks properly.
- Count ticks in English section only (before Afrikaans translation)
- Use (X) marks as primary when available
- For items with only ticks, count reasonable number (1-6)
Handles: Physical Sciences, Mathematics, Technical Sciences, Technical Mathematics.
"""

import re
from PyPDF2 import PdfReader
from bilingual_cleaner import extract_english_from_bilingual

def extract_memo_items_option_b(pdf_path):
    reader = PdfReader(pdf_path)
    page_texts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            page_texts.append(text)

    items = []

    for page_text in page_texts:
        cleaned = extract_english_from_bilingual(page_text)

        pattern = r'(\d+\.\d+(?:\.\d+)?)\s+(.*?)(?=\d+\.\d+(?:\.\d+)?|\Z)'
        all_matches = list(re.finditer(pattern, cleaned, re.DOTALL))

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

            # Skip cross-reference markers
            if any(x in content for x in ['POSITIVE MARKING FROM', 'POSITIEWE NASIEN VANAF',
                                          'NEGATIVE MARKING FROM', 'NEGATIEWE NASIEN VANAF']):
                continue

            # Skip if content is just "VRAAG" or similar (bilingual leftover)
            if re.match(r'^(VRAAG|QUESTION)\s*\d+', content):
                continue

            content = re.sub(r'\s+', ' ', content)

            marks = 0

            # STEP 1: Find ALL (X) marks in content (valid marks <= 10)
            all_marks = re.findall(r'\((\d+)\)(?!\s*x)', content)
            valid_marks = [int(m) for m in all_marks if int(m) <= 10]

            # STEP 2: If valid marks exist, use LAST one (usually at end of answer)
            if valid_marks:
                marks = valid_marks[-1]

            # STEP 3: If no valid marks, check for section marks (N x M)
            elif all_marks:
                section_marks = re.findall(r'\((\d+)\s*x\s*(\d+)\)', content)
                if section_marks:
                    marks = int(section_marks[0][1])

            # STEP 4: If still no marks, count ticks as ABSOLUTE FALLBACK
            # But limit to reasonable range (1-6) to avoid over-counting bilingual ticks
            if marks == 0:
                ticks = content.count('✓') + content.count('')
                # Only use ticks if reasonable (1-6) and no valid (X) marks were found
                if 1 <= ticks <= 6:
                    marks = ticks

            # Skip section totals: if marks > 10 and there's a [N] nearby
            if marks > 10:
                section_total = re.search(r'\[(\d+)\]', content)
                if section_total:
                    st = int(section_total.group(1))
                    if st == marks or st == marks * 2 or abs(st - marks) <= 5:
                        marks = 0

            # Clean answer text
            answer_text = content
            answer_text = re.sub(r'\(\d+\s*x\s*\d+\)', '', answer_text)
            answer_text = re.sub(r'\(\d+\)(?!\s*x)', '', answer_text)
            answer_text = re.sub(r'[✓]', '', answer_text)
            answer_text = re.sub(r'\[\d+\]', '', answer_text)
            answer_text = re.sub(r'\s+', ' ', answer_text).strip()

            if len(answer_text) < 3 and marks == 0:
                continue

            format_type = 'X.Y.Z' if len(q_num.split('.')) == 3 else 'X.Y'

            items.append({
                'question_number': q_num,
                'answer_text': answer_text[:400],
                'marks': marks,
                'source': 'memo',
                'format': format_type
            })

        # MCQ handling: "1.1 B ✓ (2)" pattern
        mcq_pattern = r'(\d+\.\d+)\s+([A-Z])\s*(?:✓|)*\s*\((\d+)\)'
        mcq_matches = list(re.finditer(mcq_pattern, cleaned))

        for match in mcq_matches:
            q_num = match.group(1)
            answer = match.group(2)
            marks = int(match.group(3))

            if not any(item['question_number'] == q_num for item in items):
                items.append({
                    'question_number': q_num,
                    'answer_text': answer,
                    'marks': marks,
                    'source': 'memo',
                    'format': 'X.Y'
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
            elif item['marks'] == existing['marks'] and len(item.get('answer_text', '')) > len(existing.get('answer_text', '')):
                best_items[q_num] = item

    return list(best_items.values())
