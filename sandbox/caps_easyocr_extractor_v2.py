#!/usr/bin/env python3
"""
QBank CAPS PDF Extractor - EasyOCR Version
Updated with correct paths from user's system.
"""

import fitz  # PyMuPDF
import json
import sys
import re
from pathlib import Path

try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False
    print("⚠ EasyOCR not installed. Run: pip install easyocr")
    sys.exit(1)

class CapsPdfExtractor:
    def __init__(self, use_gpu=False):
        if not EASYOCR_AVAILABLE:
            raise RuntimeError("EasyOCR not available")
        print("Loading EasyOCR model...")
        self.reader = easyocr.Reader(['en'], gpu=use_gpu)
        print("✓ EasyOCR ready")

    def extract_all_pages(self, pdf_path, max_pages=None):
        """Extract text from all pages (or first N pages)"""
        doc = fitz.open(pdf_path)
        all_text = []
        page_count = len(doc) if max_pages is None else min(max_pages, len(doc))

        for page_num in range(page_count):
            print(f"  Processing page {page_num + 1}/{page_count}...")
            page = doc[page_num]
            pix = page.get_pixmap(matrix=fitz.Matrix(200/72, 200/72))
            img_data = pix.tobytes("png")

            temp_img = Path(f"temp_ocr_page_{page_num}.png")
            temp_img.write_bytes(img_data)

            results = self.reader.readtext(str(temp_img), detail=0, paragraph=True)
            text = "\n".join(results)

            temp_img.unlink(missing_ok=True)
            all_text.append({
                'page': page_num + 1,
                'text': text,
                'char_count': len(text),
                'line_count': len(text.splitlines())
            })

        doc.close()
        return all_text

    def identify_topics(self, text, subject):
        """Identify CAPS topics from extracted text"""
        topics = []

        if subject == 'Physical Sciences':
            patterns = [
                (r'Mechanics', 'Mechanics'),
                (r'Waves[\s\w]*Sound[\s\w]*Light', 'Waves, Sound and Light'),
                (r'Electricity[\s\w]*Magnetism', 'Electricity and Magnetism'),
                (r'Matter[\s\w]*Materials', 'Matter and Materials'),
                (r'Chemical[\s\w]*Change', 'Chemical Change'),
                (r'Chemical[\s\w]*Systems', 'Chemical Systems')
            ]
        elif subject == 'Mathematics':
            patterns = [
                (r'Functions', 'Functions'),
                (r'Number[\s\w]*Patterns', 'Number Patterns'),
                (r'Finance', 'Finance'),
                (r'Algebra', 'Algebra'),
                (r'Calculus', 'Calculus'),
                (r'Probability', 'Probability'),
                (r'Geometry', 'Geometry'),
                (r'Analytical[\s\w]*Geometry', 'Analytical Geometry'),
                (r'Trigonometry', 'Trigonometry'),
                (r'Statistics', 'Statistics')
            ]
        elif subject == 'Life Sciences':
            patterns = [
                (r'Molecular[\s\w]*Cellular', 'Molecular and Cellular'),
                (r'Life[\s\w]*Processes', 'Life Processes'),
                (r'Environmental[\s\w]*Studies', 'Environmental Studies'),
                (r'Diversity[\s\w]*Change', 'Diversity and Change')
            ]
        elif subject == 'Accounting':
            patterns = [
                (r'Financial[\s\w]*Accounting', 'Financial Accounting'),
                (r'Managerial[\s\w]*Accounting', 'Managerial Accounting'),
                (r'Ethics[\s\w]*Internal[\s\w]*Control', 'Ethics and Internal Control'),
                (r'Recording[\s\w]*Reporting', 'Recording and Reporting')
            ]
        elif subject == 'Business Studies':
            patterns = [
                (r'Business[\s\w]*Environment', 'Business Environment'),
                (r'Business[\s\w]*Ventures', 'Business Ventures'),
                (r'Business[\s\w]*Roles', 'Business Roles'),
                (r'Business[\s\w]*Operations', 'Business Operations')
            ]
        elif subject == 'Economics':
            patterns = [
                (r'Microeconomics', 'Microeconomics'),
                (r'Macroeconomics', 'Macroeconomics'),
                (r'Economic[\s\w]*Pursuits', 'Economic Pursuits'),
                (r'Contemporary[\s\w]*Economic', 'Contemporary Economic Issues')
            ]
        elif subject == 'Geography':
            patterns = [
                (r'Climate[\s\w]*Weather', 'Climate and Weather'),
                (r'Geomorphology', 'Geomorphology'),
                (r'Population', 'Population'),
                (r'Development[\s\w]*Geography', 'Development Geography'),
                (r'Resources[\s\w]*Sustainability', 'Resources and Sustainability')
            ]
        elif subject == 'History':
            patterns = [
                (r'Capatalism[\s\w]*USA', 'Capitalism in the USA'),
                (r'Communism[\s\w]*Russia', 'Communism in Russia'),
                (r'Fascism[\s\w]*Germany', 'Fascism in Germany'),
                (r'Apartheid[\s\w]*South[\s\w]*Africa', 'Apartheid in South Africa')
            ]
        elif subject == 'Tourism':
            patterns = [
                (r'Tourism[\s\w]*Sectors', 'Tourism Sectors'),
                (r'Sustainable[\s\w]*Tourism', 'Sustainable Tourism'),
                (r'Tourism[\s\w]*Operations', 'Tourism Operations'),
                (r'Customer[\s\w]*Care', 'Customer Care')
            ]
        elif subject == 'Technical Mathematics':
            patterns = [
                (r'Algebra', 'Algebra'),
                (r'Geometry', 'Geometry'),
                (r'Trigonometry', 'Trigonometry'),
                (r'Finance', 'Finance'),
                (r'Number[\s\w]*Patterns', 'Number Patterns')
            ]
        elif subject == 'Technical Sciences':
            patterns = [
                (r'Mechanics', 'Mechanics'),
                (r'Electricity', 'Electricity'),
                (r'Waves', 'Waves'),
                (r'Chemistry', 'Chemistry')
            ]
        else:
            patterns = []

        for pattern, topic_name in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                topics.append({
                    'topic_name': topic_name,
                    'found_in_text': True
                })

        return topics

    def extract_structure(self, pdf_path, subject, max_pages=15):
        """Full extraction with topic identification"""
        print(f"\n{'='*60}")
        print(f"Extracting: {pdf_path}")
        print(f"Subject: {subject}")
        print(f"{'='*60}")

        pages = self.extract_all_pages(pdf_path, max_pages=max_pages)
        full_text = "\n".join([p['text'] for p in pages])
        topics = self.identify_topics(full_text, subject)

        result = {
            'pdf_path': str(pdf_path),
            'subject': subject,
            'total_pages': len(pages),
            'pages': pages,
            'full_text_sample': full_text[:3000],
            'identified_topics': topics,
            'extraction_method': 'EasyOCR (PyMuPDF + EasyOCR)'
        }

        print(f"\nTotal pages processed: {len(pages)}")
        print(f"Topics identified: {len(topics)}")
        for t in topics:
            print(f"  ✓ {t['topic_name']}")

        return result


def main():
    # Base directory for CAPS PDFs
    base_dir = r"C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents"

    # Auto-discover PDF files in the directory
    pdf_dir = Path(base_dir)
    if not pdf_dir.exists():
        print(f"⚠ Directory not found: {base_dir}")
        print("Please verify the path and update the script.")
        sys.exit(1)

    # Map filenames to subjects (auto-detect based on filename)
    pdf_files = []
    for pdf_file in pdf_dir.glob("*.pdf"):
        fname = pdf_file.name.upper()
        subject = None

        if 'PHYSICAL' in fname or 'PHYSIC' in fname:
            subject = 'Physical Sciences'
        elif 'LIFE' in fname or 'BIOLOGY' in fname:
            subject = 'Life Sciences'
        elif 'MATHEMATICS' in fname and 'TECHNICAL' not in fname:
            subject = 'Mathematics'
        elif 'TECHNICAL' in fname and 'MATH' in fname:
            subject = 'Technical Mathematics'
        elif 'TECHNICAL' in fname and 'SCIENCE' in fname:
            subject = 'Technical Sciences'
        elif 'ACCOUNTING' in fname:
            subject = 'Accounting'
        elif 'BUSINESS' in fname:
            subject = 'Business Studies'
        elif 'ECONOMICS' in fname:
            subject = 'Economics'
        elif 'GEOGRAPHY' in fname:
            subject = 'Geography'
        elif 'HISTORY' in fname:
            subject = 'History'
        elif 'TOURISM' in fname:
            subject = 'Tourism'
        elif 'MATH' in fname:
            subject = 'Mathematics'

        if subject:
            pdf_files.append((str(pdf_file), subject))
            print(f"Found: {pdf_file.name} → {subject}")

    if not pdf_files:
        print("⚠ No PDF files found or matched in directory:")
        print(f"  {base_dir}")
        sys.exit(1)

    print(f"\nTotal PDFs to process: {len(pdf_files)}")

    extractor = CapsPdfExtractor(use_gpu=False)
    all_results = []

    for pdf_path, subject in pdf_files:
        result = extractor.extract_structure(pdf_path, subject, max_pages=15)
        all_results.append(result)

    # Save results
    output_file = "caps_easyocr_extraction.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Results saved to: {output_file}")

    # Generate SQL
    generate_seed_sql(all_results)


def generate_seed_sql(results):
    """Generate SQL seed statements for lookup_caps_topics"""
    print(f"\n{'='*60}")
    print("GENERATING SQL SEED STATEMENTS")
    print(f"{'='*60}")

    sql_lines = ["-- CAPS Topics Seed Data (from EasyOCR extraction)", ""]

    for result in results:
        subject = result['subject']
        topics = result['identified_topics']

        sql_lines.append(f"-- Subject: {subject}")
        for topic in topics:
            topic_name = topic['topic_name'].replace("'", "''")
            sql_lines.append(f"INSERT INTO lookup_caps_topics (subject_official_code, topic_name, description, created_at)")
            sql_lines.append(f"SELECT ls.subject_official_code, '{topic_name}', 'CAPS topic: {topic_name}', NOW()")
            sql_lines.append(f"FROM lookup_subjects ls WHERE ls.name = '{subject}' LIMIT 1;")
        sql_lines.append("")

    sql_file = "caps_topics_seed.sql"
    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_lines))

    print(f"✓ SQL seed file: {sql_file}")
    print("\nPreview:")
    print("\n".join(sql_lines[:20]))


if __name__ == "__main__":
    main()
