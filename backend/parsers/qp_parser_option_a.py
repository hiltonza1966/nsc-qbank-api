#!/usr/bin/env python3
"""QP Parser Option A - Pure X.Y format (MCQ style, Geography-type papers).Placeholder - full implementation needed for Geography P2 etc."""

import re
from PyPDF2 import PdfReader
from bilingual_cleaner import extract_english_from_bilingual

def extract_qp_items_option_a(pdf_path):
    reader = PdfReader(pdf_path)
    page_texts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            page_texts.append(text)

    all_text = extract_english_from_bilingual('\n'.join(page_texts))
    items = []

    # Pure X.Y format: 1.1, 1.2, 1.3 etc. (no X.Y.Z children)
    pattern = r'(\d+\.\d+)\s+(.*?)(?=\d+\.\d+|\Z)'
    matches = list(re.finditer(pattern, all_text, re.DOTALL))

    for match in matches:
        q_num = match.group(1)
        content = match.group(2).strip()
        content = re.sub(r'\s+', ' ', content)

        marks = 0
        mark_matches = re.findall(r'\((\d+)\)', content)
        if mark_matches:
            marks = int(mark_matches[-1])

        text_clean = re.sub(r'\(\d+\)\s*$', '', content)
        text_clean = re.sub(r'\[\d+\]', '', text_clean).strip()

        if len(text_clean) < 3 and marks == 0:
            continue

        items.append({
            'question_number': q_num,
            'question_text': text_clean[:300],
            'marks': marks,
            'source': 'qp',
            'format': 'X.Y'
        })

    # Deduplicate
    best_items = {}
    for item in items:
        q_num = item['question_number']
        if q_num not in best_items:
            best_items[q_num] = item
        else:
            if item['marks'] > best_items[q_num]['marks']:
                best_items[q_num] = item
            elif item['marks'] == best_items[q_num]['marks'] and len(item['question_text']) > len(best_items[q_num]['question_text']):
                best_items[q_num] = item

    return list(best_items.values())
