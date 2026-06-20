#!/usr/bin/env python3
"""Enhanced Memo Parser - Extracts text, images, tables, and page references per question.
Uses PyMuPDF (fitz) for comprehensive extraction.
"""

import re
import fitz
import os
import json
from bilingual_cleaner import extract_english_from_bilingual


SKIP_PATTERNS = [
    'Copyright reserved', 'Please turn over', 'Please tun over',
    'DBE/November', 'NSC Confidential', 'Accounting/P1',
    'MARKING GUIDELINES', '–Marking Guidelines', 'NSC –Marking',
    'TOTAL:', 'TOTAL MARKS'
]


def extract_memo_items_enhanced(pdf_path, output_dir=None):
    """Extract memo items with full content including images and tables.

    Returns list of items, each with:
    - question_number
    - answer_text
    - marks
    - page_numbers
    - images
    - tables
    - has_visual_content
    """
    doc = fitz.open(pdf_path)

    # Extract all text with page numbers
    page_texts = []
    for page_num, page in enumerate(doc):
        text = page.get_text()
        if text:
            page_texts.append({
                'page_num': page_num + 1,
                'text': text
            })

    # Combine all text
    all_text = extract_english_from_bilingual('\n'.join([p['text'] for p in page_texts]))
    lines = all_text.split('\n')

    items = []
    current_section = None
    current_item_num = None
    current_lines = []
    current_start_pos = 0

    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue

        # Skip headers
        if any(skip in line for skip in SKIP_PATTERNS):
            continue

        # Check for main question header
        main_q_match = re.match(r'^#\s*QUESTION\s*(\d+)', line, re.IGNORECASE)
        if main_q_match:
            # Save previous item
            if current_item_num and current_lines:
                _save_enhanced_item(items, current_item_num, current_lines, current_start_pos, i, 
                                   page_texts, all_text, doc, output_dir)

            current_section = main_q_match.group(1)
            current_item_num = f"{current_section}.1"
            current_lines = []
            current_start_pos = sum(len(l) + 1 for l in lines[:i])
            continue

        # Check for explicit sub-question
        sub_q_match = re.match(r'^#?\s*(\d+\.\d+(?:\.\d+)?)\b', line)
        if sub_q_match:
            # Save previous item
            if current_item_num and current_lines:
                _save_enhanced_item(items, current_item_num, current_lines, current_start_pos, i,
                                   page_texts, all_text, doc, output_dir)

            current_item_num = sub_q_match.group(1)
            rest = line[sub_q_match.end():].strip()
            current_lines = [rest] if rest else []
            current_start_pos = sum(len(l) + 1 for l in lines[:i])
            continue

        # Regular line
        if current_item_num:
            current_lines.append(line)

    # Save last item
    if current_item_num and current_lines:
        _save_enhanced_item(items, current_item_num, current_lines, current_start_pos, len(lines),
                           page_texts, all_text, doc, output_dir)

    doc.close()

    # Deduplicate
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


def _save_enhanced_item(items, q_num, lines, start_pos, end_line_idx, page_texts, all_text, doc, output_dir):
    """Save an item with enhanced metadata."""
    content = '\n'.join(lines)

    # Extract marks
    marks = 0
    all_mark_matches = re.findall(r'\((\d+)\)', content)
    if all_mark_matches:
        marks = int(all_mark_matches[-1])

    if marks == 0:
        for line in reversed(lines[-5:]):
            line = line.strip()
            if re.match(r'^\d{1,2}$', line):
                marks = int(line)
                break

    # Clean text
    text_clean = re.sub(r'[✓✔]', '', content)
    text_clean = re.sub(r'<table>.*?</table>', '', text_clean, flags=re.DOTALL)
    text_clean = re.sub(r'\*one part correct', '', text_clean)
    text_clean = re.sub(r'\bWORKINGS\b', '', text_clean)
    text_clean = re.sub(r'\bANSWER\b', '', text_clean)
    text_clean = re.sub(r'\(\d+\)', '', text_clean)
    text_clean = re.sub(r'\[\d+\]', '', text_clean)
    text_clean = re.sub(r'\n\s*\d{1,2}\s*$', '', text_clean)
    text_clean = re.sub(r'one part correct', '', text_clean)
    text_clean = re.sub(r'one mark', '', text_clean)
    text_clean = re.sub(r'two marks', '', text_clean)
    text_clean = re.sub(r'\bm mark\b', '', text_clean)
    text_clean = re.sub(r'\s+', ' ', text_clean).strip()

    if len(text_clean) < 3 and marks == 0:
        return

    # Determine page numbers
    question_start = start_pos
    question_end = start_pos + len(content)

    page_numbers = []
    current_pos = 0
    for pt in page_texts:
        page_start = current_pos
        page_end = current_pos + len(pt['text'])

        if (question_start < page_end and question_end > page_start):
            page_numbers.append(pt['page_num'])

        current_pos = page_end + 1

    # Extract images
    images = []
    if output_dir and page_numbers:
        os.makedirs(output_dir, exist_ok=True)
        for page_num in page_numbers:
            page = doc[page_num - 1]
            image_list = page.get_images()
            for img_index, img in enumerate(image_list):
                xref = img[0]
                pix = fitz.Pixmap(doc, xref)
                if pix.n > 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                img_filename = f"{output_dir}/memo_{q_num.replace('.', '_')}_p{page_num}_img{img_index}.png"
                pix.save(img_filename)
                images.append(img_filename)

    # Extract tables
    tables = []
    for page_num in page_numbers:
        page = doc[page_num - 1]
        tabs = page.find_tables()
        for tab in tabs.tables:
            tables.append(tab.extract())

    items.append({
        'question_number': q_num,
        'answer_text': text_clean[:400],
        'marks': marks,
        'page_numbers': page_numbers,
        'images': images,
        'tables': tables,
        'has_visual_content': len(images) > 0 or len(tables) > 0,
        'source': 'memo'
    })


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        output_dir = sys.argv[2] if len(sys.argv) > 2 else None
        items = extract_memo_items_enhanced(sys.argv[1], output_dir)
        print(json.dumps(items, indent=2))
