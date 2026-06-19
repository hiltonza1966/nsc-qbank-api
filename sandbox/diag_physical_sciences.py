#!/usr/bin/env python3
"""
Physical Sciences OCR Diagnostic
Dumps raw OCR text to see actual format
"""

import fitz
from pathlib import Path

try:
    import easyocr
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    print("ERROR: EasyOCR not installed")
    exit(1)

pdf_path = r"C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents\CAPS FET PHYSICAL SCIENCE WEB.pdf"

print("Loading EasyOCR...")
reader = easyocr.Reader(['en'], gpu=False)
print("✓ Ready")

doc = fitz.open(pdf_path)
print(f"Total pages: {len(doc)}")

# Process pages 5-15 (where Section 3 usually is)
for page_num in range(4, min(15, len(doc))):
    print(f"\n{'='*60}")
    print(f"PAGE {page_num + 1}")
    print(f"{'='*60}")

    page = doc[page_num]
    pix = page.get_pixmap(matrix=fitz.Matrix(200/72, 200/72))
    img_data = pix.tobytes("png")

    temp_img = Path(f"diag_page_{page_num}.png")
    temp_img.write_bytes(img_data)

    try:
        results = reader.readtext(str(temp_img), detail=0, paragraph=True)
        text = "\n".join(results)

        # Print first 50 lines
        lines = text.split('\n')
        for i, line in enumerate(lines[:50]):
            if line.strip():
                print(f"  {i+1}: {line.strip()[:100]}")
    finally:
        temp_img.unlink(missing_ok=True)

doc.close()
print("\nDiagnostic complete")
