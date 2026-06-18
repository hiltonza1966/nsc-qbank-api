#!/usr/bin/env python3
"""
QBank CAPS PDF Extractor - HYBRID v2 (Corrected Mappings)
Processes 12 PDFs in root folder with accurate subject detection.
"""

import fitz
import json
import sys
import re
from pathlib import Path

try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False

class HybridCapsExtractor:
    def __init__(self, use_gpu=False):
        self.reader = None
        if EASYOCR_AVAILABLE:
            print("Loading EasyOCR...")
            self.reader = easyocr.Reader(['en'], gpu=use_gpu)
            print("✓ EasyOCR ready")

    def _is_valid_text(self, text):
        if not text or len(text.strip()) < 30:
            return False
        printable = sum(1 for c in text if c.isprintable() or c.isspace())
        ratio = printable / len(text) if text else 0
        return ratio > 0.85

    def extract_all_pages(self, pdf_path, max_pages=10):
        doc = fitz.open(pdf_path)
        page_count = len(doc) if max_pages is None else min(max_pages, len(doc))
        doc.close()

        all_text = []
        direct_count = 0
        ocr_count = 0

        for page_num in range(page_count):
            print(f"  Page {page_num + 1}/{page_count}...", end=" ")

            doc = fitz.open(pdf_path)
            page = doc[page_num]
            text = page.get_text()
            is_valid = self._is_valid_text(text)
            method = "direct"

            if not is_valid and self.reader:
                pix = page.get_pixmap(matrix=fitz.Matrix(150/72, 150/72))
                img_data = pix.tobytes("png")
                temp_img = Path(f"temp_ocr_{page_num}.png")
                temp_img.write_bytes(img_data)
                results = self.reader.readtext(str(temp_img), detail=0, paragraph=True)
                text = "\n".join(results)
                temp_img.unlink(missing_ok=True)
                method = "ocr_fallback"
                ocr_count += 1
            elif is_valid:
                direct_count += 1
            else:
                method = "failed"

            doc.close()
            all_text.append({
                'page': page_num + 1,
                'text': text,
                'method': method,
                'char_count': len(text)
            })
            print(f"✓ {method}")

        print(f"\n  Summary: {direct_count} direct, {ocr_count} OCR, {page_count - direct_count - ocr_count} failed")
        return all_text

    def identify_topics(self, text, subject):
        topics = []
        text_lower = text.lower()

        subject_patterns = {
            'Physical Sciences': [
                (r'Mechanics', 'Mechanics'),
                (r'Waves[\s\w]*Sound[\s\w]*Light', 'Waves, Sound and Light'),
                (r'Electricity[\s\w]*Magnetism', 'Electricity and Magnetism'),
                (r'Matter[\s\w]*Materials', 'Matter and Materials'),
                (r'Chemical[\s\w]*Change', 'Chemical Change'),
                (r'Chemical[\s\w]*Systems', 'Chemical Systems')
            ],
            'Mathematics': [
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
            ],
            'Mathematical Literacy': [
                (r'Numbers[\s\w]*Operations', 'Numbers and Operations'),
                (r'Patterns', 'Patterns'),
                (r'Finance', 'Finance'),
                (r'Data[\s\w]*Handling', 'Data Handling'),
                (r'Measurement', 'Measurement'),
                (r'Maps[\s\w]*Plans', 'Maps and Plans'),
                (r'Probability', 'Probability')
            ],
            'Life Sciences': [
                (r'Molecular[\s\w]*Cellular', 'Molecular and Cellular'),
                (r'Life[\s\w]*Processes', 'Life Processes'),
                (r'Environmental[\s\w]*Studies', 'Environmental Studies'),
                (r'Diversity[\s\w]*Change', 'Diversity and Change')
            ],
            'Life Orientation': [
                (r'Personal[\s\w]*Well-being', 'Personal Well-being'),
                (r'Citizenship', 'Citizenship'),
                (r'Careers[\s\w]*Career', 'Careers and Career Choices'),
                (r'Social[\s\w]*Responsibility', 'Social Responsibility'),
                (r'Physical[\s\w]*Development', 'Physical Development')
            ],
            'Accounting': [
                (r'Financial[\s\w]*Accounting', 'Financial Accounting'),
                (r'Managerial[\s\w]*Accounting', 'Managerial Accounting'),
                (r'Ethics[\s\w]*Internal[\s\w]*Control', 'Ethics and Internal Control'),
                (r'Recording[\s\w]*Reporting', 'Recording and Reporting')
            ],
            'Business Studies': [
                (r'Business[\s\w]*Environment', 'Business Environment'),
                (r'Business[\s\w]*Ventures', 'Business Ventures'),
                (r'Business[\s\w]*Roles', 'Business Roles'),
                (r'Business[\s\w]*Operations', 'Business Operations')
            ],
            'Economics': [
                (r'Microeconomics', 'Microeconomics'),
                (r'Macroeconomics', 'Macroeconomics'),
                (r'Economic[\s\w]*Pursuits', 'Economic Pursuits'),
                (r'Contemporary[\s\w]*Economic', 'Contemporary Economic Issues')
            ],
            'Geography': [
                (r'Climate[\s\w]*Weather', 'Climate and Weather'),
                (r'Geomorphology', 'Geomorphology'),
                (r'Population', 'Population'),
                (r'Development[\s\w]*Geography', 'Development Geography'),
                (r'Resources[\s\w]*Sustainability', 'Resources and Sustainability')
            ],
            'Agricultural Sciences': [
                (r'Animal[\s\w]*Production', 'Animal Production'),
                (r'Plant[\s\w]*Production', 'Plant Production'),
                (r'Agricultural[\s\w]*Management', 'Agricultural Management'),
                (r'Soil[\s\w]*Science', 'Soil Science')
            ]
        }

        patterns = subject_patterns.get(subject, [])
        for pattern, topic_name in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                topics.append({'topic_name': topic_name, 'found_in_text': True})

        return topics

    def extract_structure(self, pdf_path, subject, max_pages=10):
        print(f"\n{'='*60}")
        print(f"Extracting: {Path(pdf_path).name}")
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
            'extraction_method': 'Hybrid (PyMuPDF direct + EasyOCR fallback)'
        }

        print(f"\nTopics identified: {len(topics)}")
        for t in topics:
            print(f"  ✓ {t['topic_name']}")

        return result


def main():
    base_dir = r"C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents"
    pdf_dir = Path(base_dir)

    if not pdf_dir.exists():
        print(f"⚠ Directory not found: {base_dir}")
        sys.exit(1)

    # CORRECTED subject mapping
    pdf_files = []
    for pdf_file in pdf_dir.glob("*.pdf"):
        fname = pdf_file.name.upper()
        subject = None
        skip = False

        # Skip non-CAPS documents
        if 'AMENDMENTS' in fname or 'AMENDED' in fname:
            skip = True
        elif 'FET CAP DRAFT' in fname:
            skip = True
        elif 'ART SUBJECTS' in fname:
            skip = True
        elif 'SECTION 4' in fname:
            skip = True
        elif 'CAPS MAPPING' in fname:
            skip = True
        # Match subjects
        elif 'PHYSICAL' in fname:
            subject = 'Physical Sciences'
        elif 'LIFE ORIENTATION' in fname:
            subject = 'Life Orientation'
        elif 'LIFE SCIENCE' in fname:
            subject = 'Life Sciences'
        elif 'MATHEMATICAL LITERACY' in fname:
            subject = 'Mathematical Literacy'
        elif 'MATHEMATICS' in fname:
            subject = 'Mathematics'
        elif 'ACCOUNTING' in fname:
            subject = 'Accounting'
        elif 'BUSINESS' in fname:
            subject = 'Business Studies'
        elif 'ECONOMICS' in fname:
            subject = 'Economics'
        elif 'GEOGRAPHY' in fname:
            subject = 'Geography'
        elif 'AGRICULTURAL' in fname:
            subject = 'Agricultural Sciences'
        elif 'HISTORY' in fname:
            subject = 'History'
        elif 'TOURISM' in fname:
            subject = 'Tourism'
        elif 'TECHNICAL' in fname and 'MATH' in fname:
            subject = 'Technical Mathematics'
        elif 'TECHNICAL' in fname and 'SCIENCE' in fname:
            subject = 'Technical Sciences'

        if skip:
            print(f"Skip: {pdf_file.name}")
        elif subject:
            pdf_files.append((str(pdf_file), subject))
            print(f"Found: {pdf_file.name} → {subject}")
        else:
            print(f"Unmatched: {pdf_file.name}")

    if not pdf_files:
        print("⚠ No valid CAPS PDFs found")
        sys.exit(1)

    print(f"\nTotal PDFs to process: {len(pdf_files)}")

    extractor = HybridCapsExtractor(use_gpu=False)
    all_results = []

    for pdf_path, subject in pdf_files:
        result = extractor.extract_structure(pdf_path, subject, max_pages=10)
        all_results.append(result)

    # Save results
    with open("caps_hybrid_extraction.json", 'w', encoding='utf-8') as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Results saved to: caps_hybrid_extraction.json")

    # Generate SQL
    generate_seed_sql(all_results)


def generate_seed_sql(results):
    print(f"\n{'='*60}")
    print("GENERATING SQL SEED STATEMENTS")
    print(f"{'='*60}")

    sql_lines = ["-- CAPS Topics Seed Data (Hybrid extraction v2)", ""]

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

    with open("caps_topics_seed.sql", 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_lines))

    print(f"✓ SQL seed file: caps_topics_seed.sql")
    print("\nPreview:")
    print("\n".join(sql_lines[:20]))


if __name__ == "__main__":
    main()
