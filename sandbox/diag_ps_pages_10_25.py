#!/usr/bin/env python3
"""
Physical Sciences CAPS Diagnostic - Pages 10-25
Extracts full text from Section 2 (Overview) through Section 3 start
Uses pymupdf (fitz) for fast text extraction
"""

import fitz  # pymupdf
import sys
import json

def diagnose_pages(pdf_path, start_page=10, end_page=25):
    """Extract detailed text from specified page range"""
    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    print(f"Total pages in PDF: {total_pages}")
    print(f"Extracting pages {start_page} to {end_page}...")
    print("=" * 70)

    results = []

    for page_num in range(start_page - 1, min(end_page, total_pages)):
        page = doc[page_num]
        text = page.get_text()

        print(f"\n{'='*70}")
        print(f"PAGE {page_num + 1}")
        print(f"{'='*70}")
        print(text)
        print(f"{'='*70}")

        results.append({
            "page": page_num + 1,
            "text": text
        })

    doc.close()

    # Save raw text for analysis
    with open("physical_sciences_pages_10_25.txt", "w", encoding="utf-8") as f:
        for r in results:
            f.write(f"\n{'='*70}\n")
            f.write(f"PAGE {r['page']}\n")
            f.write(f"{'='*70}\n")
            f.write(r['text'])
            f.write("\n")

    print(f"\nSaved to physical_sciences_pages_10_25.txt")
    return results

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python diag_ps_pages_10_25.py <path_to_pdf>")
        print("Example: python diag_ps_pages_10_25.py \"C:/Users/visagie.h/Downloads/Physical Sciences CAPS.pdf\"")
        sys.exit(1)

    pdf_path = sys.argv[1]
    diagnose_pages(pdf_path, 10, 25)
