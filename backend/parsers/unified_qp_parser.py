#!/usr/bin/env python3
"""Unified QP Parser - Handles PDF (Option A & B) and DOCX formats.
Auto-detects format and extracts question items with marks.
FIX: Format detection now looks at ALL pages, not just first 3.
"""

import re
import os
from PyPDF2 import PdfReader
from bilingual_cleaner import extract_english_from_bilingual

def detect_format(file_path):
    """Detect file format and paper structure type.
    Looks at ALL pages to find X.Y.Z patterns (not just first 3).
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext == '.docx':
        return 'docx', 'option_b'

    elif ext == '.pdf':
        reader = PdfReader(file_path)
        all_text = ""
        # Look at ALL pages for format detection (not just first 3)
        for page in reader.pages:
            text = page.extract_text() or ""
            all_text += text + "\n"

        # Clean bilingual text
        cleaned = extract_english_from_bilingual(all_text)

        # Count X.Y vs X.Y.Z patterns
        xy = set(re.findall(r'\b(\d+\.\d+)\b', cleaned))
        xyz = set(re.findall(r'\b(\d+\.\d+\.\d+)\b', cleaned))

        # Check if X.Y items have X.Y.Z children
        xy_parents = 0
        for q in xy:
            children = [x for x in xyz if x.startswith(q + '.')]
            if children:
                xy_parents += 1

        # NEW: If ANY X.Y.Z patterns exist, use option_b
        if xyz and xy_parents > 0:
            return 'pdf', 'option_b'
        elif xyz and not xy_parents:
            # Pure X.Y.Z without X.Y parents (rare, but possible)
            return 'pdf', 'option_b'
        else:
            return 'pdf', 'option_a'  # Pure X.Y (MCQ style)

    else:
        raise ValueError(f"Unsupported file format: {ext}")

def extract_qp_items(file_path):
    """Main entry point: Extract question items from any QP file."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == '.docx':
        from docx_extractor import extract_qp_items_from_docx
        return extract_qp_items_from_docx(file_path)

    elif ext == '.pdf':
        _, format_type = detect_format(file_path)
        if format_type == 'option_a':
            from qp_parser_option_a import extract_qp_items_option_a
            return extract_qp_items_option_a(file_path)
        else:
            from qp_parser_option_b import extract_qp_items_option_b
            return extract_qp_items_option_b(file_path)

    else:
        raise ValueError(f"Unsupported format: {ext}")

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: python unified_qp_parser.py <qp_file>")
        sys.exit(1)

    items = extract_qp_items(sys.argv[1])
    print(f"Found {len(items)} items")
    for item in items[:10]:
        print(f"  Q{item['question_number']}: {item['marks']} marks - {item['question_text'][:50]}")
    total = sum(i['marks'] for i in items)
    print(f"Total marks: {total}")
