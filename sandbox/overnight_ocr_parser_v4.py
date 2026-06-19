#!/usr/bin/env python3
"""
CAPS Overnight OCR Parser - v4
Uses EasyOCR to extract topics, subtopics, grades, terms, weeks from CAPS PDFs
Extracts ALL fields matching Excel structure
"""

import fitz  # PyMuPDF
import json
import re
import time
import traceback
from pathlib import Path
from datetime import datetime
from collections import defaultdict

try:
    import easyocr
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    print("ERROR: EasyOCR not installed. Run: pip install easyocr")
    exit(1)

# Configuration - OPTIMIZED for overnight
CONFIG = {
    'dpi': 200,  # Higher DPI for better OCR accuracy
    'max_pages': 25,  # Process first 25 pages (Section 3 is usually here)
    'sleep_between_pages': 2,  # 2 seconds between pages (prevent overheating)
    'sleep_between_subjects': 30,  # 30 seconds between subjects
    'save_interval': 1,  # Save after each subject
}

# Missing subjects with PDF mapping
SUBJECTS = [
    {"code": "10001014", "name": "English Home Language", "pdf": "CAPS FET _ HOME _ ENGLISH GR 10-12 _ WEB_5478.pdf", "strand": "Languages"},
    {"code": "10001034", "name": "Life Sciences", "pdf": "CAPS FET _ LIFE SCIENCES _ GR 10-12 Web_2636.pdf", "strand": "Natural Sciences"},
    {"code": "10001064", "name": "Physical Sciences", "pdf": "CAPS FET PHYSICAL SCIENCE WEB.pdf", "strand": "Natural Sciences"},
    {"code": "10001094", "name": "Afrikaans Home Language", "pdf": "CAPS FET _ HOME _ AFRIKAANS GR 10-12 _ WEB_0544.PDF", "strand": "Languages"},
    {"code": "10001114", "name": "Afrikaans First Additional Language", "pdf": "CAPS FET _ FAL _ AFRIKAANS GR 10-12 _ WEB_9455.pdf", "strand": "Languages"},
    {"code": "10001204", "name": "Computer Applications Technology", "pdf": "CAPS FET _ COMPUTER APPLICATIONS TECHNOLOGY _ GR 10-12 _ Web_6AC6.pdf", "strand": "Technology"},
    {"code": "10001234", "name": "Consumer Studies", "pdf": "CAPS FET _ Consumer Studies GR 10-12 _ WEB_C5DB.pdf", "strand": "Economic & Management Sciences"},
    {"code": "10001284", "name": "Engineering Graphics and Design", "pdf": "CAPS FET _ ENGINEERING GRAPICHS & DESIGN _ GR 10-12 _ Web_8899.pdf", "strand": "Technology"},
    {"code": "10001324", "name": "English First Additional Language", "pdf": "CAPS FET _ FAL _ ENGLISH GR 10-12 _ WEB_65DC.pdf", "strand": "Languages"},
    {"code": "10001404", "name": "Information Technology", "pdf": "CAPS FET _ INFORMATION TECHNOLOGY _ GR 10-12 _ Web_E677.pdf", "strand": "Technology"},
    {"code": "10001424", "name": "Life Orientation", "pdf": "CAPS FET _ LIFE ORIENTATION _ GR 10-12 _ WEB_E6B3.pdf", "strand": "Health & Wellness"},
    {"code": "10001524", "name": "Sepedi Home Language", "pdf": "CAPS FET _ HOME _ SEPEDI GR 10-12 _ WEB_9F5B.pdf", "strand": "Languages"},
    {"code": "10001594", "name": "isiZulu Home Language", "pdf": "CAPS FET _ HOME _ ISIZULU GR 10-12 _ WEB_5D5A.pdf", "strand": "Languages"},
    {"code": "10001614", "name": "isiXhosa Home Language", "pdf": "CAPS FET _ HOME _ ISIXHOSA GR 10-12 _ Web_9E70.pdf", "strand": "Languages"},
    {"code": "10351054", "name": "Agricultural Sciences", "pdf": "CAPS FET _ AGRICULTURAL SCIENCE _ WEB_1CC4.pdf", "strand": "Natural Sciences"},
    {"code": "11351084", "name": "Dramatic Arts", "pdf": "CAPS FET _ DRAMATIC ARTS _ GR 10-12 _ WEB_EA5E.pdf", "strand": "Arts"},
    {"code": "11351124", "name": "Hospitality Studies", "pdf": "CAPS FET _ HOSPITALITY STUDIES _ GR 10-12 _ Web_2EA7.pdf", "strand": "Services"},
    {"code": "11351154", "name": "Music", "pdf": "CAPS FET _ MUSIC _ GR 10-12 _ Web_84B0.pdf", "strand": "Arts"},
    {"code": "11351184", "name": "Visual Arts", "pdf": "CAPS FET _ VISUAL ARTS _ GR 10-12 _ WEB_A758.pdf", "strand": "Arts"},
]

BASE_DIR = Path(r"C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents")
OUTPUT_DIR = Path(r"C:\dev\nsc-qbank\sandbox\overnight_ocr_results")
LOG_FILE = OUTPUT_DIR / "ocr_parser_log.txt"
PROGRESS_FILE = OUTPUT_DIR / "ocr_progress.json"

def log(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    print(line)
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(line + '\n')

def save_progress(progress):
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, indent=2)

def load_progress():
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"completed": [], "failed": [], "current": None}

class CapsOcrExtractor:
    def __init__(self, use_gpu=False):
        if not OCR_AVAILABLE:
            raise RuntimeError("EasyOCR not available")
        log("Loading EasyOCR model...")
        self.reader = easyocr.Reader(['en'], gpu=use_gpu)
        log("✓ EasyOCR ready")

    def extract_pages(self, pdf_path, max_pages=25):
        """Extract text from PDF pages using OCR"""
        doc = fitz.open(pdf_path)
        all_text = []
        page_count = min(max_pages, len(doc))

        for page_num in range(page_count):
            log(f"  OCR page {page_num + 1}/{page_count}...")

            page = doc[page_num]
            # Render at higher DPI for better OCR
            pix = page.get_pixmap(matrix=fitz.Matrix(CONFIG['dpi']/72, CONFIG['dpi']/72))
            img_data = pix.tobytes("png")

            temp_img = Path(f"temp_ocr_page_{page_num}.png")
            temp_img.write_bytes(img_data)

            try:
                results = self.reader.readtext(str(temp_img), detail=0, paragraph=True)
                text = "\n".join(results)

                if text.strip():
                    all_text.append({
                        'page': page_num + 1,
                        'text': text
                    })
            except Exception as e:
                log(f"    OCR error on page {page_num + 1}: {e}")
            finally:
                temp_img.unlink(missing_ok=True)

            # Cooldown between pages
            time.sleep(CONFIG['sleep_between_pages'])

        doc.close()
        return all_text

    def parse_topics(self, text_data, subject_name):
        """Parse topics and subtopics from OCR text"""
        topics = []
        current_topic = None
        in_section_3 = False

        for page_data in text_data:
            text = page_data['text']
            lines = text.split('\n')

            for line in lines:
                line = line.strip()
                if not line:
                    continue

                # Detect Section 3
                if re.search(r'Section\s*3', line, re.IGNORECASE) or \
                   re.search(r'Content\s+and\s+scope', line, re.IGNORECASE):
                    in_section_3 = True
                    log(f"  Found Section 3 at page {page_data['page']}")
                    continue

                # Detect Section 4 (end of Section 3)
                if re.search(r'Section\s*4', line, re.IGNORECASE) or \
                   re.search(r'Assessment', line, re.IGNORECASE):
                    in_section_3 = False
                    continue

                if not in_section_3:
                    continue

                # Detect topic headers - multiple patterns
                topic_match = None

                # Pattern 1: "3.1 Topic Name"
                if not topic_match:
                    topic_match = re.match(r'^3\.(\d+)\s+(.+)', line)

                # Pattern 2: "Topic 1: Name" or "Topic 1 Name"
                if not topic_match:
                    topic_match = re.match(r'^Topic\s+(\d+)[:\.]?\s*(.+)', line, re.IGNORECASE)

                # Pattern 3: Numbered items like "1. Topic Name" (but not "1. " alone)
                if not topic_match:
                    topic_match = re.match(r'^(\d+)\.\s+([A-Z][A-Za-z\s\-]+)', line)

                # Pattern 4: Bold/strong text that looks like a topic
                if not topic_match:
                    if len(line) > 15 and len(line) < 100 and line[0].isupper() and \
                       not line.endswith('.') and not line.endswith(','):
                        # Check if next line is indented (subtopic)
                        topic_match = re.match(r'^([A-Z][A-Za-z\s\-]+)', line)

                if topic_match:
                    topic_num = topic_match.group(1) if len(topic_match.groups()) > 1 else str(len(topics) + 1)
                    topic_name = topic_match.group(2) if len(topic_match.groups()) > 1 else topic_match.group(1)

                    if current_topic:
                        topics.append(current_topic)

                    current_topic = {
                        'number': topic_num,
                        'name': topic_name.strip(),
                        'subtopics': [],
                        'grades': set(),
                        'terms': set(),
                        'weeks': set(),
                        'caps_refs': set(),
                        'page': page_data['page']
                    }
                    continue

                if current_topic:
                    # Extract grade indicators
                    grade_matches = re.findall(r'Grade\s*(10|11|12)', line, re.IGNORECASE)
                    for grade in grade_matches:
                        current_topic['grades'].add(grade)

                    # Extract term indicators
                    term_matches = re.findall(r'Term\s*(1|2|3|4)', line, re.IGNORECASE)
                    for term in term_matches:
                        current_topic['terms'].add(term)

                    # Extract week/time indicators
                    week_matches = re.findall(r'(\d+)\s*week', line, re.IGNORECASE)
                    for week in week_matches:
                        current_topic['weeks'].add(week)

                    # Extract subtopics (bullet points, indented text)
                    subtopic_match = re.match(r'^[\-\•\*\◦\▪]\s*(.+)', line)
                    if not subtopic_match:
                        subtopic_match = re.match(r'^\s{2,}(.+)', line)

                    if subtopic_match:
                        subtopic_name = subtopic_match.group(1).strip()
                        if len(subtopic_name) > 10 and subtopic_name not in current_topic['subtopics']:
                            current_topic['subtopics'].append(subtopic_name)

        if current_topic:
            topics.append(current_topic)

        return topics

def generate_sql(subject, topics, topic_counter_start):
    """Generate complete SQL with ALL fields"""
    sql_lines = []
    topic_counter = topic_counter_start

    sql_lines.append(f"-- Subject: {subject['name']} ({subject['code']})")

    for i, topic in enumerate(topics, 1):
        topic_code = f"CAPS{topic_counter:04d}"
        topic_counter += 1

        topic_name = topic['name'].replace("'", "''")[:255]

        grades_list = sorted(topic['grades'])
        grade_number = grades_list[0] if grades_list else 'NULL'
        if grade_number != 'NULL':
            try:
                grade_number = int(grade_number)
            except:
                grade_number = 'NULL'

        terms_list = sorted(topic['terms'])
        term = str(terms_list[0]) if terms_list else 'NULL'
        if term != 'NULL':
            term = f"'{term}'"

        weeks_list = sorted(topic['weeks'])
        time_weeks = weeks_list[0] if weeks_list else 'NULL'
        if time_weeks != 'NULL':
            try:
                time_weeks = int(time_weeks)
            except:
                time_weeks = 'NULL'

        description = f"CAPS topic for {subject['name']}"
        if grades_list:
            description += f" | Grades: {', '.join(grades_list)}"
        if terms_list:
            description += f" | Terms: {', '.join(terms_list)}"
        if weeks_list:
            description += f" | Weeks: {', '.join(weeks_list)}"
        description = description.replace("'", "''")[:500]

        sql_lines.append(f"")
        sql_lines.append(f"INSERT INTO lookup_caps_topics (")
        sql_lines.append(f"    subject_official_code, grade_id, grade_number, strand,")
        sql_lines.append(f"    term, topic_code, topic_name, topic_weighting,")
        sql_lines.append(f"    time_weeks, paper_no, description, is_active, display_order")
        sql_lines.append(f") VALUES (")
        sql_lines.append(f"    '{subject['code']}, NULL, {grade_number}, '{subject['strand']}',")
        sql_lines.append(f"    {term}, '{topic_code}', '{topic_name}', NULL,")
        sql_lines.append(f"    {time_weeks}, NULL, '{description}', 1, {i * 10}")
        sql_lines.append(f");")
        sql_lines.append(f"SET @topic_id = LAST_INSERT_ID();")

        for j, subtopic in enumerate(topic['subtopics'][:15], 1):
            subtopic_name = subtopic.replace("'", "''")[:255]
            subtopic_code = re.sub(r'[^a-zA-Z0-9]', '_', subtopic[:20]).upper()

            sql_lines.append(f"INSERT INTO lookup_caps_subtopics (")
            sql_lines.append(f"    topic_id, subtopic_code, subtopic_name,")
            sql_lines.append(f"    description, is_active, display_order")
            sql_lines.append(f") VALUES (")
            sql_lines.append(f"    @topic_id, '{subtopic_code}', '{subtopic_name}',")
            sql_lines.append(f"    'CAPS subtopic for {subject['name']}', 1, {j * 10}")
            sql_lines.append(f");")

        sql_lines.append("")

    return sql_lines, topic_counter

def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    with open(LOG_FILE, 'w', encoding='utf-8') as f:
        f.write(f"CAPS OCR Parser Started: {datetime.now()}\n")
        f.write(f"Config: {json.dumps(CONFIG, indent=2)}\n")
        f.write("="*60 + "\n\n")

    progress = load_progress()
    log(f"Progress: {len(progress['completed'])} completed, {len(progress['failed'])} failed")

    extractor = CapsOcrExtractor(use_gpu=False)

    topic_counter = 96
    all_sql = []

    for subject in SUBJECTS:
        subject_code = subject['code']
        subject_name = subject['name']
        pdf_name = subject['pdf']
        pdf_path = BASE_DIR / pdf_name

        if subject_code in progress['completed']:
            log(f"SKIP {subject_name} - already completed")
            continue

        log(f"\n{'='*60}")
        log(f"Processing: {subject_name} ({subject_code})")
        log(f"PDF: {pdf_path}")
        log(f"{'='*60}")

        progress['current'] = subject_code
        save_progress(progress)

        try:
            if not pdf_path.exists():
                log(f"ERROR: PDF not found: {pdf_path}")
                progress['failed'].append(subject_code)
                save_progress(progress)
                continue

            log(f"Starting OCR extraction...")
            text_data = extractor.extract_pages(str(pdf_path), CONFIG['max_pages'])
            log(f"Extracted {len(text_data)} pages")

            log(f"Parsing topics...")
            topics = extractor.parse_topics(text_data, subject_name)

            total_subtopics = sum(len(t['subtopics']) for t in topics)
            log(f"Found {len(topics)} topics with {total_subtopics} subtopics")

            if topics:
                for t in topics[:3]:
                    log(f"  Topic: {t['name']} (Grades: {sorted(t['grades'])}, Subtopics: {len(t['subtopics'])})")

                sql_lines, topic_counter = generate_sql(subject, topics, topic_counter)
                all_sql.extend(sql_lines)

                subject_sql_file = OUTPUT_DIR / f"{subject_code}_{subject_name.replace(' ', '_')}.sql"
                with open(subject_sql_file, 'w', encoding='utf-8') as f:
                    f.write('\n'.join(sql_lines))
                log(f"SQL saved: {subject_sql_file}")

                progress['completed'].append(subject_code)
                log(f"✓ SUCCESS: {subject_name}")
            else:
                log(f"⚠ No topics found for {subject_name}")
                progress['failed'].append(subject_code)

            save_progress(progress)

            log(f"Cooling down for {CONFIG['sleep_between_subjects']} seconds...")
            time.sleep(CONFIG['sleep_between_subjects'])

        except Exception as e:
            log(f"ERROR: {str(e)}")
            log(traceback.format_exc())
            progress['failed'].append(subject_code)
            save_progress(progress)
            time.sleep(60)

    if all_sql:
        combined_sql = [
            "USE nsc_qbank;",
            "SET FOREIGN_KEY_CHECKS = 0;",
            "",
        ] + all_sql + [
            "",
            "SET FOREIGN_KEY_CHECKS = 1;",
        ]

        combined_file = OUTPUT_DIR / "combined_ocr_seed.sql"
        with open(combined_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(combined_sql))
        log(f"\nCombined SQL: {combined_file}")

    log(f"\n{'='*60}")
    log(f"OCR PARSER COMPLETE")
    log(f"Completed: {len(progress['completed'])}/{len(SUBJECTS)}")
    log(f"Failed: {len(progress['failed'])}")
    log(f"{'='*60}")

if __name__ == '__main__':
    main()
