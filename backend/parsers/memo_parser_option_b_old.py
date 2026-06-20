#!/usr/bin/env python3
"""Memo Parser Option B - Hybrid X.Y + X.Y.Z format (PyMuPDF version).
Handles bilingual memos and cross-subject compatibility.
Updated to use PyMuPDF (fitz) for better text extraction.
"""

import re
import fitz
from bilingual_cleaner import extract_english_from_bilingual

def extract_memo_items_option_b(pdf_path):
    """Extract memo items from Memo PDF using PyMuPDF."""
    doc = fitz.open(pdf_path)
    page_texts = []
    for page in doc:
        text = page.get_text()
        if text:
            page_texts.append(text)
    doc.close()

    all_text = extract_english_from_bilingual('\n'.join(page_texts))
    items = []

    pattern = r'(\d+\.\d+(?:\.\d+)?)\s*(.+?)(?=\s*\d+\.\d+(?:\.\d+)?|\Z)'
    all_matches = list(re.finditer(pattern, all_text, re.DOTALL))

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

        content = re.sub(r'\s+', ' ', content)

        marks = 0

        mark_matches = re.findall(r'\((\d+)\)(?!\s*x)', content)
        if mark_matches:
            marks = int(mark_matches[-1])

        section_mark = re.search(r'\((\d+)\s*x\s*(\d+)\)', content)
        if section_mark and marks == 0:
            marks = int(section_mark.group(2))

        end_mark = re.search(r'(\d+)\s*marks?\s*$', content, re.IGNORECASE)
        if end_mark and marks == 0:
            marks = int(end_mark.group(1))

        bracket_mark = re.search(r'\[(\d+)\]\s*$', content)
        if bracket_mark and marks == 0:
            marks = int(bracket_mark.group(1))

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
