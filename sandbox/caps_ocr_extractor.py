#!/usr/bin/env python3
"""
QBank CAPS PDF OCR Extractor
Extracts clean text from DBE CAPS PDFs with font encoding issues.
Uses PyMuPDF for rendering + pytesseract for OCR.
"""

import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io
import json
import sys
import re
from pathlib import Path

# Tesseract config (Windows path if needed)
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

class CapsPdfExtractor:
    def __init__(self, dpi=300):
        self.dpi = dpi
        self.results = {}

    def extract_page(self, pdf_path, page_num=0):
        """Extract text from a single page using OCR"""
        doc = fitz.open(pdf_path)
        page = doc[page_num]

        # Render page to image at high DPI
        pix = page.get_pixmap(matrix=fitz.Matrix(self.dpi/72, self.dpi/72))
        img_data = pix.tobytes("png")
        img = Image.open(io.BytesIO(img_data))

        # OCR with Tesseract
        text = pytesseract.image_to_string(img, lang='eng')

        doc.close()
        return text

    def extract_all_pages(self, pdf_path):
        """Extract text from all pages"""
        doc = fitz.open(pdf_path)
        all_text = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            pix = page.get_pixmap(matrix=fitz.Matrix(self.dpi/72, self.dpi/72))
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            text = pytesseract.image_to_string(img, lang='eng')
            all_text.append({
                'page': page_num + 1,
                'text': text,
                'char_count': len(text),
                'line_count': len(text.splitlines())
            })

        doc.close()
        return all_text

    def identify_topics(self, text, subject):
        """Identify CAPS topics from extracted text based on subject patterns"""
        topics = []
        lines = text.splitlines()

        if subject == 'Physical Sciences':
            # Look for Mechanics, Waves, Electricity, Matter, Chemical Change, Chemical Systems
            patterns = [
                (r'Mechanics', 'Mechanics'),
                (r'Waves[\s\w]*Sound[\s\w]*Light', 'Waves, Sound and Light'),
                (r'Electricity[\s\w]*Magnetism', 'Electricity and Magnetism'),
                (r'Matter[\s\w]*Materials', 'Matter and Materials'),
                (r'Chemical\s+Change', 'Chemical Change'),
                (r'Chemical\s+Systems', 'Chemical Systems')
            ]
        elif subject == 'Mathematics':
            patterns = [
                (r'Functions', 'Functions'),
                (r'Number\s+Patterns', 'Number Patterns'),
                (r'Finance', 'Finance'),
                (r'Algebra', 'Algebra'),
                (r'Calculus', 'Calculus'),
                (r'Probability', 'Probability'),
                (r'Geometry', 'Geometry'),
                (r'Analytical\s+Geometry', 'Analytical Geometry'),
                (r'Trigonometry', 'Trigonometry'),
                (r'Statistics', 'Statistics')
            ]
        elif subject == 'Life Sciences':
            # Knowledge strands
            patterns = [
                (r'Molecular[\s\w]*Cellular', 'Molecular and Cellular'),
                (r'Life\s+Processes', 'Life Processes'),
                (r'Environmental\s+Studies', 'Environmental Studies'),
                (r'Diversity[\s\w]*Change', 'Diversity and Change')
            ]
        else:
            patterns = []

        for pattern, topic_name in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                topics.append({
                    'topic_name': topic_name,
                    'found_in_text': True,
                    'pattern': pattern
                })

        return topics

    def extract_structure(self, pdf_path, subject):
        """Full extraction: text + topic identification"""
        print(f"\n{'='*60}")
        print(f"Extracting: {pdf_path}")
        print(f"Subject: {subject}")
        print(f"{'='*60}")

        # Extract all pages
        pages = self.extract_all_pages(pdf_path)

        # Combine all text for topic analysis
        full_text = "\n".join([p['text'] for p in pages])

        # Identify topics
        topics = self.identify_topics(full_text, subject)

        result = {
            'pdf_path': str(pdf_path),
            'subject': subject,
            'total_pages': len(pages),
            'pages': pages[:3],  # First 3 pages for preview
            'full_text_sample': full_text[:2000],  # First 2000 chars
            'identified_topics': topics,
            'extraction_method': 'OCR (PyMuPDF + Tesseract)',
            'dpi': self.dpi
        }

        print(f"Total pages: {len(pages)}")
        print(f"Topics identified: {len(topics)}")
        for t in topics:
            print(f"  ✓ {t['topic_name']}")

        return result


def main():
    # Configuration - adjust paths to your local PDFs
    pdf_files = [
        # (path, subject_name)
        (r"C:\dev\nsc-qbank\pdfs\Physical_Sciences_GR12_CAPS.pdf", "Physical Sciences"),
        (r"C:\dev\nsc-qbank\pdfs\Mathematics_GR12_CAPS.pdf", "Mathematics"),
        (r"C:\dev\nsc-qbank\pdfs\Life_Sciences_GR12_CAPS.pdf", "Life Sciences"),
    ]

    extractor = CapsPdfExtractor(dpi=300)
    all_results = []

    for pdf_path, subject in pdf_files:
        if Path(pdf_path).exists():
            result = extractor.extract_structure(pdf_path, subject)
            all_results.append(result)
        else:
            print(f"⚠ File not found: {pdf_path}")

    # Save results
    output_file = "caps_ocr_extraction.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"Results saved to: {output_file}")
    print(f"{'='*60}")

    # Generate SQL seed statements
    generate_seed_sql(all_results)


def generate_seed_sql(results):
    """Generate SQL INSERT statements for lookup_caps_topics"""
    print(f"\n{'='*60}")
    print("GENERATING SQL SEED STATEMENTS")
    print(f"{'='*60}")

    sql_lines = []
    sql_lines.append("-- CAPS Topics Seed Data")
    sql_lines.append("-- Generated from OCR extraction")
    sql_lines.append("")

    for result in results:
        subject = result['subject']
        topics = result['identified_topics']

        sql_lines.append(f"-- Subject: {subject}")

        for topic in topics:
            topic_name = topic['topic_name'].replace("'", "''")
            sql_lines.append(f"INSERT INTO lookup_caps_topics (subject_official_code, topic_name, description, created_at) VALUES")
            sql_lines.append(f"  ((SELECT subject_official_code FROM lookup_subjects WHERE name = '{subject}' LIMIT 1), '{topic_name}', 'CAPS topic: {topic_name}', NOW());")

        sql_lines.append("")

    sql_file = "caps_topics_seed.sql"
    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_lines))

    print(f"SQL seed file generated: {sql_file}")
    print("\nPreview of SQL:")
    print("\n".join(sql_lines[:20]))


if __name__ == "__main__":
    main()
