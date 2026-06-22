#!/usr/bin/env python3
"""Memo Content Parser - Extracts answer text, images, tables, page refs.
Does NOT extract marks. Pure content extraction only.
"""

import re
import fitz
import os
import json

try:
    from bilingual_cleaner import extract_english_from_bilingual
except ImportError:
    def extract_english_from_bilingual(text):
        return text

SKIP_PATTERNS = [
    'Copyright reserved', 'Please turn over', 'Please tun over',
    'DBE/November', 'NSC Confidential', 'Accounting/P1',
    'MARKING GUIDELINES', '–Marking Guidelines', 'NSC –Marking',
    'TOTAL:', 'TOTAL MARKS', 'TOTALMARKS',
    'MARKS:150', 'MARKING PRINCIPLES'
]


def extract_memo_content(pdf_path, output_dir=None):
    """Extract memo answer content without marks.

    Returns list of items with:
    - question_number
    - answer_text
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
    current_item_num = None
    current_lines = []
    current_start_pos = 0

    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue

        # Skip headers and structural lines
        if any(skip in line for skip in SKIP_PATTERNS):
            continue

        # Skip TOTALMARKS table rows
        if re.match(r'^\|TOTALMARKS\|', line):
            continue
        if re.match(r'^\|:?-+:?\|$', line):
            continue
        if re.match(r'^\|\s*\d+\s*\|$', line):
            continue

        # Check for main question header: # QUESTION N
        main_q_match = re.match(r'^#\s*QUESTION\s*(\d+)', line, re.IGNORECASE)
        if main_q_match:
            # Save previous item
            if current_item_num and current_lines:
                _save_memo_content_item(items, current_item_num, current_lines, current_start_pos, i,
                                       page_texts, all_text, doc, output_dir)

            current_section = main_q_match.group(1)
            current_item_num = f"{current_section}.1"
            current_lines = []
            current_start_pos = sum(len(l) + 1 for l in lines[:i])
            continue

        # Check for explicit sub-question: X.Y or X.Y.Z
        sub_q_match = re.match(r'^#?\s*(\d+\.\d+(?:\.\d+)?)\b', line)
        if sub_q_match:
            # Save previous item
            if current_item_num and current_lines:
                _save_memo_content_item(items, current_item_num, current_lines, current_start_pos, i,
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
        _save_memo_content_item(items, current_item_num, current_lines, current_start_pos, len(lines),
                               page_texts, all_text, doc, output_dir)

    doc.close()

    # Deduplicate - keep longest text for each question number
    best_items = {}
    for item in items:
        q_num = item['question_number']
        if q_num not in best_items:
            best_items[q_num] = item
        else:
            existing = best_items[q_num]
            if len(item.get('answer_text', '')) > len(existing.get('answer_text', '')):
                best_items[q_num] = item

    return list(best_items.values())


def _save_memo_content_item(items, q_num, lines, start_pos, end_line_idx, page_texts, all_text, doc, output_dir):
    """Save a memo content item without marks extraction."""
    content = '\n'.join(lines)

    # Clean text - remove marking symbols but keep answer content
    text_clean = re.sub(r'[✓✔☑√]', '', content)
    text_clean = re.sub(r'<table>.*?</table>', '', text_clean, flags=re.DOTALL)
    text_clean = re.sub(r'\*one part correct', '', text_clean)
    text_clean = re.sub(r'\bWORKINGS\b', '', text_clean)
    text_clean = re.sub(r'\bANSWER\b', '', text_clean)
    text_clean = re.sub(r'\(\d+\)', '', text_clean)
    text_clean = re.sub(r'\[\d+\]', '', text_clean)
    text_clean = re.sub(r'one part correct', '', text_clean)
    text_clean = re.sub(r'one mark', '', text_clean)
    text_clean = re.sub(r'two marks', '', text_clean)
    text_clean = re.sub(r'\bm mark\b', '', text_clean)
    text_clean = re.sub(r'\s+', ' ', text_clean).strip()

    # Skip if too short
    if len(text_clean) < 3:
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
            try:
                image_list = page.get_images()
                for img_index, img in enumerate(image_list):
                    xref = img[0]
                    try:
                        pix = fitz.Pixmap(doc, xref)
                        if pix.n > 4:
                            pix = fitz.Pixmap(fitz.csRGB, pix)
                        img_filename = f"{output_dir}/memo_{q_num.replace('.', '_')}_p{page_num}_img{img_index}.png"
                        pix.save(img_filename)
                        images.append(img_filename)
                    except Exception:
                        pass
            except Exception:
                pass

    # Extract tables
    # NOTE: Table extraction disabled due to PyMuPDF bug with these PDFs
    tables = []

    items.append({
        'question_number': q_num,
        'answer_text': text_clean,
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
        items = extract_memo_content(sys.argv[1], output_dir)
        print(json.dumps(items, indent=2))
