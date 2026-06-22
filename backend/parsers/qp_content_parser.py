#!/usr/bin/env python3
"""QP Content Parser - Extracts question text, images, tables, page refs.
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


def extract_qp_content(pdf_path, output_dir=None):
    """Extract question content without marks.

    Returns list of items with:
    - question_number
    - question_text
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

    # Combine all text for position tracking
    all_text = extract_english_from_bilingual('\n'.join([p['text'] for p in page_texts]))

    # Find all question numbers: X.Y or X.Y.Z format
    # Must be followed by text content (not just whitespace)
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

        # Clean text - remove marks allocations but keep full question content
        text_clean = re.sub(r'\(\d+\)', '', content)
        text_clean = re.sub(r'\[\d+\]', '', text_clean)
        text_clean = re.sub(r'\(\d+\s*x\s*\d+\)', '', text_clean)
        text_clean = re.sub(r'\d+\s*marks?\s*$', '', text_clean, flags=re.IGNORECASE)
        text_clean = re.sub(r'REQUIRED:', '', text_clean)
        text_clean = re.sub(r'NOTE:', '', text_clean)
        text_clean = re.sub(r'INFORMATION:', '', text_clean)
        text_clean = text_clean.strip()

        # Skip if too short (likely a false match)
        if len(text_clean) < 3:
            continue

        # Determine which pages this question appears on
        question_start = match.start()
        question_end = end_pos

        page_numbers = []
        current_pos = 0
        for pt in page_texts:
            page_start = current_pos
            page_end = current_pos + len(pt['text'])

            if (question_start < page_end and question_end > page_start):
                page_numbers.append(pt['page_num'])

            current_pos = page_end + 1

        # Extract images for this question's pages
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
                            if pix.n > 4:  # CMYK: convert to RGB
                                pix = fitz.Pixmap(fitz.csRGB, pix)
                            img_filename = f"{output_dir}/q{q_num.replace('.', '_')}_p{page_num}_img{img_index}.png"
                            pix.save(img_filename)
                            images.append(img_filename)
                        except Exception:
                            pass
                except Exception:
                    pass

        # Extract tables for this question's pages
        # NOTE: Table extraction disabled due to PyMuPDF bug with these PDFs
        tables = []

        items.append({
            'question_number': q_num,
            'question_text': text_clean,
            'page_numbers': page_numbers,
            'images': images,
            'tables': tables,
            'has_visual_content': len(images) > 0 or len(tables) > 0,
            'source': 'qp'
        })

    doc.close()

    # Deduplicate - keep longest text for each question number
    best_items = {}
    for item in items:
        q_num = item['question_number']
        if q_num not in best_items:
            best_items[q_num] = item
        else:
            existing = best_items[q_num]
            if len(item['question_text']) > len(existing['question_text']):
                best_items[q_num] = item

    return list(best_items.values())


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        output_dir = sys.argv[2] if len(sys.argv) > 2 else None
        items = extract_qp_content(sys.argv[1], output_dir)
        print(json.dumps(items, indent=2))
