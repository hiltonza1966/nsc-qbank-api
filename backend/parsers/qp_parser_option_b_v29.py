#!/usr/bin/env python3
"""Enhanced QP Parser - Extracts text, images, tables, and page references per question.
Uses PyMuPDF (fitz) for comprehensive extraction.
"""

import re
import fitz
import os
import json
from bilingual_cleaner import extract_english_from_bilingual


def extract_qp_items_enhanced(pdf_path, output_dir=None):
    """Extract question items with full content including images and tables.

    Returns list of items, each with:
    - question_number
    - question_text
    - marks
    - page_numbers (list of pages where this question appears)
    - images (list of image file paths extracted for this question)
    - tables (list of table data extracted for this question)
    - has_visual_content (bool)
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

    # Find all question numbers with positions
    q_pattern = r'(?<![\d.])(\d+\.\d+(?:\.\d+)?)(?=\s|[A-Za-z]|$)'
    matches = list(re.finditer(q_pattern, all_text))

    # Filter valid matches (must have text after)
    valid_matches = []
    for m in matches:
        start_pos = m.end()
        if start_pos < len(all_text):
            next_chars = all_text[start_pos:start_pos + 50]
            if re.search(r'[A-Za-z]', next_chars):
                valid_matches.append(m)

    items = []

    for i, match in enumerate(valid_matches):
        q_num = match.group(1)
        start_pos = match.end()

        if i + 1 < len(valid_matches):
            end_pos = valid_matches[i + 1].start()
        else:
            end_pos = len(all_text)

        content = all_text[start_pos:end_pos].strip()

        # Extract marks
        marks = 0
        all_mark_matches = re.findall(r'\((\d+)\)', content)
        if all_mark_matches:
            marks = int(all_mark_matches[-1])

        bracket_matches = re.findall(r'\[(\d+)\]', content)
        if bracket_matches and marks == 0:
            marks = int(bracket_matches[-1])

        end_num_match = re.search(r'\n\s*(\d{1,2})\s*$', content)
        if end_num_match and marks == 0:
            marks = int(end_num_match.group(1))

        # Clean text
        text_clean = re.sub(r'\(\d+\)', '', content)
        text_clean = re.sub(r'\[\d+\]', '', text_clean)
        text_clean = re.sub(r'\(\d+\s*x\s*\d+\)', '', text_clean)
        text_clean = re.sub(r'\d+\s*marks?\s*$', '', text_clean, flags=re.IGNORECASE)
        text_clean = re.sub(r'REQUIRED:', '', text_clean)
        text_clean = re.sub(r'NOTE:', '', text_clean)
        text_clean = text_clean.strip()

        if len(text_clean) < 3 and marks == 0:
            continue

        # Determine which pages this question appears on
        # Find the position of this question in the combined text
        # Then map back to page numbers
        question_start = match.start()
        question_end = end_pos

        page_numbers = []
        current_pos = 0
        for pt in page_texts:
            page_start = current_pos
            page_end = current_pos + len(pt['text'])

            # Check if question overlaps with this page
            if (question_start < page_end and question_end > page_start):
                page_numbers.append(pt['page_num'])

            current_pos = page_end + 1  # +1 for newline

        # Extract images for this question's pages
        images = []
        if output_dir and page_numbers:
            os.makedirs(output_dir, exist_ok=True)
            for page_num in page_numbers:
                page = doc[page_num - 1]  # 0-indexed
                image_list = page.get_images()
                for img_index, img in enumerate(image_list):
                    xref = img[0]
                    pix = fitz.Pixmap(doc, xref)
                    if pix.n > 4:  # CMYK: convert to RGB
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    img_filename = f"{output_dir}/q{q_num.replace('.', '_')}_p{page_num}_img{img_index}.png"
                    pix.save(img_filename)
                    images.append(img_filename)

        # Extract tables for this question's pages
        tables = []
        for page_num in page_numbers:
            page = doc[page_num - 1]
            tabs = page.find_tables()
            for tab in tabs.tables:
                tables.append(tab.extract())

        items.append({
            'question_number': q_num,
            'question_text': text_clean[:500],
            'marks': marks,
            'page_numbers': page_numbers,
            'images': images,
            'tables': tables,
            'has_visual_content': len(images) > 0 or len(tables) > 0,
            'source': 'qp'
        })

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
            elif item['marks'] == existing['marks'] and len(item['question_text']) > len(existing['question_text']):
                best_items[q_num] = item

    return list(best_items.values())


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        output_dir = sys.argv[2] if len(sys.argv) > 2 else None
        items = extract_qp_items_enhanced(sys.argv[1], output_dir)
        print(json.dumps(items, indent=2))
