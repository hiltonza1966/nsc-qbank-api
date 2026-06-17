#!/usr/bin/env python3
"""Memo Parser v3d - Refined with better mark extraction and text cleaning"""
import re
from PyPDF2 import PdfReader

def extract_memo_items_v3d(pdf_path):
    reader = PdfReader(pdf_path)

    # Extract page by page
    page_texts = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            page_texts.append(text)

    # Use clean pages (skip page 3 which is tick version)
    clean_pages = page_texts[3:] if len(page_texts) > 3 else page_texts

    items = []
    q_pattern = r'(\d+\.\d+\.\d+)\s+(.*?)(?=\d+\.\d+\.\d+|\Z)'

    for page_text in clean_pages:
        matches = list(re.finditer(q_pattern, page_text, re.DOTALL))
        for match in matches:
            q_num = match.group(1)
            content = match.group(2).strip()

            # Skip 2-part numbers
            if len(q_num.split('.')) != 3:
                continue

            # Clean content - remove page artifacts
            content = re.sub(r'\s+', ' ', content)
            content = re.sub(r'Please turn over', '', content)
            content = re.sub(r'Copyright reserved', '', content)

            # Extract answer text
            answer_text = content

            # STRATEGY 1: Find section marks (count x marks_per) - MOST RELIABLE
            # Pattern: (4 x 2) = 8 marks total, 2 per item
            section_marks = re.findall(r'\((\d+)\s*x\s*(\d+)\)', content)

            # STRATEGY 2: Find inline marks
            inline_marks = re.findall(r'\)\s*\((\d+)\)(?!\s*x)', content)
            if not inline_marks:
                inline_marks = re.findall(r'[a-zA-Z]\s+\((\d+)\)(?!\s*x)', content)

            # STRATEGY 3: Count ticks
            ticks = content.count('✓') + content.count('')

            # Determine final mark
            mark = 0

            # Check if this is a paragraph/essay question
            is_paragraph = any(x in content.lower() for x in ['paragraph', 'essay', 'any four', 'any three', 'f+q'])

            if section_marks:
                # Use marks_per (second number) e.g., (4 x 2) -> 2 marks per item, total 8
                count = int(section_marks[-1][0])
                marks_per = int(section_marks[-1][1])
                total = count * marks_per

                # For paragraph questions, use total marks
                if is_paragraph or total >= 6:
                    mark = total
                else:
                    mark = marks_per
            elif inline_marks:
                mark = int(inline_marks[-1])
            elif ticks > 0 and ticks <= 6:
                mark = ticks

            # Special cases based on content analysis
            if 'f+q' in content.lower() or 'any three' in content.lower():
                # These are multi-part questions with higher marks
                if mark < 6:
                    mark = 6  # Default for F+Q questions

            # Clean answer text
            answer_text = re.sub(r'\(\d+\s*x\s*\d+\)', '', answer_text)
            answer_text = re.sub(r'\(\d+\)(?!\s*x)', '', answer_text)
            answer_text = re.sub(r'[✓]', '', answer_text)
            answer_text = re.sub(r'\s+', ' ', answer_text).strip()

            # Extract clean answer (remove question text artifacts)
            # Look for actual answer content after action words
            answer_start = re.search(r'(?:[A-Z][a-z]+.*?)(?:[•√]|\([a-z]\)|[A-Z]\s)', answer_text)
            if answer_start and answer_start.start() > 20:
                answer_text = answer_text[answer_start.start():]

            # Remove trailing artifacts
            answer_text = re.sub(r'\d+\s*$', '', answer_text).strip()

            items.append({
                'question_number': q_num,
                'answer_text': answer_text[:400],
                'marks': mark,
                'inline_marks': inline_marks,
                'section_marks': section_marks,
                'ticks': ticks,
                'is_paragraph': is_paragraph,
                'source': 'memo'
            })

    # Deduplicate - keep best version
    best_items = {}
    for item in items:
        q_num = item['question_number']
        if q_num not in best_items:
            best_items[q_num] = item
        else:
            existing = best_items[q_num]
            if item['marks'] > existing['marks']:
                best_items[q_num] = item
            elif item['marks'] == existing['marks'] and len(item['answer_text']) > len(existing['answer_text']):
                best_items[q_num] = item

    return list(best_items.values())
