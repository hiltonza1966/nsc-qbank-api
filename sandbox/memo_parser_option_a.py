#!/usr/bin/env python3
"""Option A Memo Parser - For Geography/History-style DBE papers
Handles: X.Y.Z numbering, inline marks (1), section marks (4 x 2), clean text memos
"""
import re
from PyPDF2 import PdfReader

def extract_memo_items_option_a(pdf_path):
    reader = PdfReader(pdf_path)

    page_texts = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            page_texts.append(text)

    # Use clean pages (skip tick version on early pages)
    clean_pages = page_texts[3:] if len(page_texts) > 3 else page_texts

    items = []
    q_pattern = r'(\d+\.\d+\.\d+)\s+(.*?)(?=\d+\.\d+\.\d+|\Z)'

    for page_text in clean_pages:
        matches = list(re.finditer(q_pattern, page_text, re.DOTALL))
        for match in matches:
            q_num = match.group(1)
            content = match.group(2).strip()

            if len(q_num.split('.')) != 3:
                continue

            content = re.sub(r'\s+', ' ', content)
            content = re.sub(r'Please turn over', '', content)
            content = re.sub(r'Copyright reserved', '', content)

            answer_text = content

            # Extract marks
            section_marks = re.findall(r'\((\d+)\s*x\s*(\d+)\)', content)
            inline_marks = re.findall(r'\)\s*\((\d+)\)(?!\s*x)', content)
            if not inline_marks:
                inline_marks = re.findall(r'[a-zA-Z]\s+\((\d+)\)(?!\s*x)', content)
            ticks = content.count('✓') + content.count('')

            mark = 0
            is_paragraph = any(x in content.lower() for x in ['paragraph', 'essay', 'any four', 'any three', 'f+q'])

            if section_marks:
                count = int(section_marks[-1][0])
                marks_per = int(section_marks[-1][1])
                total = count * marks_per
                if is_paragraph or total >= 6:
                    mark = total
                else:
                    mark = marks_per
            elif inline_marks:
                mark = int(inline_marks[-1])
            elif ticks > 0 and ticks <= 6:
                mark = ticks

            # FIX: Detect last MCQ item (section total bleed)
            # If mark > 5 and answer is very short (A/B/C/D/Y/Z), it's likely section total
            if mark > 5:
                # Check if answer is just a letter or very short
                clean_answer = re.sub(r'[^a-zA-Z]', '', answer_text).strip()
                if len(clean_answer) <= 2 and clean_answer in ['A', 'B', 'C', 'D', 'Y', 'Z']:
                    mark = 1  # MCQ items are 1 mark each

            # Special cases
            if 'f+q' in content.lower() or 'any three' in content.lower():
                if mark < 6:
                    mark = 6

            # Clean answer text
            answer_text = re.sub(r'\(\d+\s*x\s*\d+\)', '', answer_text)
            answer_text = re.sub(r'\(\d+\)(?!\s*x)', '', answer_text)
            answer_text = re.sub(r'[✓]', '', answer_text)
            answer_text = re.sub(r'\s+', ' ', answer_text).strip()
            answer_text = re.sub(r'\d+\s*$', '', answer_text).strip()

            items.append({
                'question_number': q_num,
                'answer_text': answer_text[:400],
                'marks': mark,
                'source': 'memo'
            })

    # Deduplicate
    best_items = {}
    for item in items:
        q_num = item['question_number']
        if q_num not in best_items or item['marks'] > best_items[q_num]['marks']:
            best_items[q_num] = item

    return list(best_items.values())
