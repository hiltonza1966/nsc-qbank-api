#!/usr/bin/env python3
"""
qp_content_parser.py — v3 Spatial Image Tracking & Correct Attachment Linkage

CRITICAL FIX (v3): Images were linked to headers only. Now uses spatial proximity
                   to assign images to correct items (sub-items, sub-headers, headers).

Key Changes from v2:
1. Extract ALL images with bounding box coordinates (x0, y0, x1, y1) per page
2. Detect question number positions with their y-coordinates on each page
3. Assign images to nearest question number by vertical proximity
4. Link images to sub-items, sub-headers, and headers correctly
5. Store image metadata with linked_question_number for harness inheritance
"""

import os
import re
import json
import io
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

import fitz  # PyMuPDF
from PIL import Image


# ──────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────

MIN_IMAGE_WIDTH = 30   # pixels — filter out tiny icons/artifacts
MIN_IMAGE_HEIGHT = 30  # pixels
IMAGE_QUALITY = 85


try:
    from bilingual_cleaner import extract_english_from_bilingual
except ImportError:
    def extract_english_from_bilingual(text):
        return text


# Footer artifact patterns that indicate low-quality content
FOOTER_PATTERNS = [
    'please turn over', 'please tun over', 'turn over',
    'copyright reserved', 'copyright', 'confidential',
    'nsc confidential', 'dbe/november', 'accounting/p1',
    'total:', 'total marks', 'totalmarks', 'marks:150',
    'marking principles', 'nsc',
]


# ──────────────────────────────────────────────────────────────
# Spatial Image Extractor
# ──────────────────────────────────────────────────────────────

def extract_images_with_positions(doc: fitz.Document, output_dir: str, paper_code: str) -> List[Dict[str, Any]]:
    """
    Extract ALL images from PDF with their precise page coordinates.
    Uses PyMuPDF get_image_rects() for spatial positioning.

    Returns list of dicts with: image_id, page_num, x0, y0, x1, y1, 
    width, height, file_path, file_name, file_size, mime_type
    """
    images = []
    image_counter = 0

    os.makedirs(output_dir, exist_ok=True)

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_num = page_idx + 1

        # Get all images on this page with their bounding boxes
        image_list = page.get_images(full=True)

        for img_info in image_list:
            xref = img_info[0]

            # Get image rectangles (position on page) — KEY FIX
            rects = page.get_image_rects(xref, transform=True)
            if not rects:
                continue

            # Use the first rect (main placement)
            rect = rects[0]
            if isinstance(rect, tuple):
                rect = rect[0]  # Some versions return (rect, matrix)

            x0, y0, x1, y1 = rect.x0, rect.y0, rect.x1, rect.y1
            width = x1 - x0
            height = y1 - y0

            # Skip tiny images (likely icons/artifacts)
            if width < MIN_IMAGE_WIDTH or height < MIN_IMAGE_HEIGHT:
                continue

            # Extract and save image
            try:
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                ext = base_image["ext"]

                image_counter += 1
                file_name = f"{paper_code}_p{page_num}_img{image_counter:04d}.{ext}"
                file_path = os.path.join(output_dir, file_name)

                # Save image
                img = Image.open(io.BytesIO(image_bytes))
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                img.save(file_path, quality=IMAGE_QUALITY)
                file_size = os.path.getsize(file_path)

                # Determine mime type
                mime_map = {'png': 'image/png', 'jpg': 'image/jpeg', 
                            'jpeg': 'image/jpeg', 'gif': 'image/gif',
                            'bmp': 'image/bmp', 'tiff': 'image/tiff'}
                mime_type = mime_map.get(ext.lower(), 'image/png')

                images.append({
                    'image_id': f"{paper_code}_p{page_num}_{image_counter:04d}",
                    'page_num': page_num,
                    'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1,
                    'width': width, 'height': height,
                    'file_path': file_path,
                    'file_name': file_name,
                    'file_size': file_size,
                    'mime_type': mime_type,
                    'linked_question_number': None,  # Will be filled by linker
                    'proximity_score': 0.0
                })

            except Exception as e:
                print(f"  [WARN] Failed to extract image xref {xref} on page {page_num}: {e}")
                continue

    return images


# ──────────────────────────────────────────────────────────────
# Question Zone Detector with Positions
# ──────────────────────────────────────────────────────────────

def detect_question_positions(all_text: str, page_texts: List[Dict]) -> List[Dict[str, Any]]:
    """
    Detect question numbers and their approximate vertical positions.
    Returns list of {question_number, page_num, y_start, y_end, is_header, header_level, parent_number}
    """
    zones = []

    # Process each page separately to get accurate y-positions
    for pt in page_texts:
        page_num = pt['page_num']
        page_text = pt['text']

        # Find all question numbers on this page with their positions
        # Pattern: X.Y or X.Y.Z at start of line or after whitespace
        q_pattern = r'(?<![\d.])(\d+\.\d+(?:\.\d+)?)(?=\s|[A-Za-z]|$)'

        for match in re.finditer(q_pattern, page_text):
            q_num = match.group(1)
            start_pos = match.start()

            # Calculate approximate y-position based on text position in page
            # (proportion of text length through page)
            text_before = page_text[:start_pos]
            lines_before = text_before.count('\n')
            total_lines = max(page_text.count('\n'), 1)
            y_ratio = lines_before / total_lines if total_lines > 0 else 0

            # Determine hierarchy
            parts = q_num.split('.')
            level = len(parts) - 1  # 0 for "1", 1 for "1.1", 2 for "1.1.1"
            is_header = level >= 1

            # Determine parent
            parent = None
            if len(parts) > 1:
                parent = '.'.join(parts[:-1])

            zones.append({
                'question_number': q_num,
                'page_num': page_num,
                'y_start': y_ratio,  # 0.0 to 1.0 relative position
                'y_end': y_ratio + 0.1,  # Approximate zone height
                'is_header': is_header,
                'header_level': level,
                'parent_number': parent
            })

    # Deduplicate zones (keep first occurrence per page per question number)
    seen = set()
    unique_zones = []
    for z in zones:
        key = (z['page_num'], z['question_number'])
        if key not in seen:
            seen.add(key)
            unique_zones.append(z)

    # Sort by page then y position
    unique_zones.sort(key=lambda z: (z['page_num'], z['y_start']))

    # Adjust zone boundaries (y_end = next zone's y_start or page end)
    for i in range(len(unique_zones)):
        if i < len(unique_zones) - 1 and unique_zones[i]['page_num'] == unique_zones[i+1]['page_num']:
            unique_zones[i]['y_end'] = unique_zones[i+1]['y_start']
        else:
            unique_zones[i]['y_end'] = 1.0

    return unique_zones


# ──────────────────────────────────────────────────────────────
# Image-to-Question Linker (SPATIAL PROXIMITY)
# ──────────────────────────────────────────────────────────────

def link_images_to_questions(images: List[Dict], zones: List[Dict]) -> List[Dict]:
    """
    Assign each image to the nearest question number by spatial proximity.

    KEY ALGORITHM:
    - For each image, calculate its center y-position on the page
    - Find the question zone whose y-range is closest to the image
    - Images ABOVE a question are more likely to belong to it (diagrams before text)
    - Images BELOW a question may belong to the next question
    """
    if not zones:
        return images

    # Index zones by page
    zones_by_page = defaultdict(list)
    for z in zones:
        zones_by_page[z['page_num']].append(z)

    for page_num in zones_by_page:
        zones_by_page[page_num].sort(key=lambda z: z['y_start'])

    for img in images:
        page_num = img['page_num']
        page_zones = zones_by_page.get(page_num, [])

        if not page_zones:
            img['linked_question_number'] = None
            continue

        # Image center y (relative to page height, 0=top, 1=bottom)
        # Use y0 (top of image) as reference point
        img_y = img['y0'] / 800.0  # Approximate page height normalization

        best_zone = None
        best_score = float('inf')

        for zone in page_zones:
            zone_y_start = zone['y_start']
            zone_y_end = zone['y_end']

            # Calculate vertical distance
            if img_y < zone_y_start:
                # Image is above the zone
                v_dist = zone_y_start - img_y
            elif img_y > zone_y_end:
                # Image is below the zone
                v_dist = img_y - zone_y_end
            else:
                # Image overlaps with zone
                v_dist = 0

            # Score: images above question get bonus (diagrams typically precede question text)
            # Images below get penalty (might belong to next question)
            if img_y < zone_y_start:
                score = v_dist * 0.3  # Strong preference for images above
            elif img_y > zone_y_end:
                score = v_dist * 3.0  # Weak preference for images below
            else:
                score = v_dist * 0.1  # Inside zone = best match

            if score < best_score:
                best_score = score
                best_zone = zone

        if best_zone:
            img['linked_question_number'] = best_zone['question_number']
            img['proximity_score'] = best_score
        else:
            img['linked_question_number'] = None

    return images


# ──────────────────────────────────────────────────────────────
# Main Extractor
# ──────────────────────────────────────────────────────────────

def extract_qp_content(pdf_path, output_dir=None):
    """
    Extract question content with spatially-linked images.

    Returns list of items with:
    - question_number
    - question_text
    - page_numbers
    - images (directly linked to this question)
    - inherited_images (from parent headers)
    - tables
    - has_visual_content
    - is_header, header_level, parent_header_q
    """
    doc = fitz.open(pdf_path)
    paper_code = os.path.splitext(os.path.basename(pdf_path))[0]

    # Extract all text with page numbers
    page_texts = []
    for page_num, page in enumerate(doc):
        text = page.get_text()
        if not text:
            try:
                import pytesseract
                from PIL import Image as PILImage
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                img = PILImage.frombytes('RGB', [pix.width, pix.height], pix.samples)
                text = pytesseract.image_to_string(img)
                print(f'  [OCR] Page {page_num + 1}: extracted {len(text)} chars')
            except Exception as e:
                print(f'  [OCR] Page {page_num + 1}: failed - {e}')
                text = ''
        if text:
            page_texts.append({
                'page_num': page_num + 1,
                'text': text
            })

    # Combine all text for position tracking
    all_text = extract_english_from_bilingual('\n'.join([p['text'] for p in page_texts]))

    # === STEP 1: Extract ALL images with spatial coordinates ===
    all_images = []
    if output_dir:
        qp_img_dir = os.path.join(output_dir, 'qp_images')
        os.makedirs(qp_img_dir, exist_ok=True)
        all_images = extract_images_with_positions(doc, qp_img_dir, paper_code)
        print(f"  [Images] Extracted {len(all_images)} images with positions")

    # === STEP 2: Detect question zones with positions ===
    zones = detect_question_positions(all_text, page_texts)
    print(f"  [Zones] Detected {len(zones)} question zones")

    # === STEP 3: Link images to questions by spatial proximity ===
    if all_images and zones:
        all_images = link_images_to_questions(all_images, zones)

        # Log linkage summary
        linkage_summary = defaultdict(int)
        for img in all_images:
            if img['linked_question_number']:
                linkage_summary[img['linked_question_number']] += 1
        print(f"  [Linkage] Linked images to {len(linkage_summary)} question numbers")
        for q_num, count in sorted(linkage_summary.items(), key=lambda x: x[0]):
            print(f"    {q_num}: {count} images")

    # === STEP 4: Extract question text (same as v2) ===
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

        # Determine hierarchy from zones
        zone = next((z for z in zones if z['question_number'] == q_num), None)
        is_header = zone['is_header'] if zone else False
        header_level = zone['header_level'] if zone else 0
        parent_header_q = zone['parent_number'] if zone else None

        # Get directly linked images for this question
        direct_images = [img for img in all_images 
                        if img['linked_question_number'] == q_num]

        # Get inherited images from parent headers
        inherited_images = []
        parts = q_num.split('.')
        for j in range(len(parts) - 1, 0, -1):
            parent_num = '.'.join(parts[:j])
            parent_images = [img for img in all_images 
                           if img['linked_question_number'] == parent_num]
            inherited_images.extend(parent_images)

        # Combine for display
        all_item_images = direct_images + inherited_images

        # Extract tables (placeholder for future enhancement)
        tables = []

        items.append({
            'question_number': q_num,
            'question_text': text_clean,
            'page_numbers': page_numbers,
            'images': [img['file_path'] for img in all_item_images],
            'image_metadata': all_item_images,  # Full metadata for harness
            'tables': tables,
            'has_visual_content': len(all_item_images) > 0 or len(tables) > 0,
            'source': 'qp',
            'is_header': 1 if is_header else 0,
            'header_level': header_level,
            'parent_header_q': parent_header_q,
            'direct_image_count': len(direct_images),
            'inherited_image_count': len(inherited_images)
        })

    doc.close()

    # === STRICT DEDUPLICATION: Keep ONLY first occurrence per question number ===
    seen = set()
    unique_items = []
    duplicates_skipped = 0

    for item in items:
        q_num = item['question_number']
        if q_num not in seen:
            seen.add(q_num)
            unique_items.append(item)
        else:
            duplicates_skipped += 1

    if duplicates_skipped > 0:
        print(f"  [Dedup] Skipped {duplicates_skipped} duplicates, kept {len(unique_items)} unique items")

    return unique_items


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        output_dir = sys.argv[2] if len(sys.argv) > 2 else None
        items = extract_qp_content(sys.argv[1], output_dir)
        print(json.dumps(items, indent=2, default=str))
