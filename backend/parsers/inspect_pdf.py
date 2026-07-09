import fitz, sys, re

pdf_path = r"C:\dev\nsc-qbank\docs\Question Papers\Test\LIFESCIENCES_P1_2025_NOV_ENG_QP.pdf"

doc = fitz.open(pdf_path)

for i in range(4, 8):  # Pages 5-8 (0-indexed: 4-7)
    print(f"=== PAGE {i+1} ===")
    text = doc[i].get_text()
    # Show first 2500 chars
    print(text[:2500])
    print("\n" + "="*60 + "\n")

doc.close()
