#!/usr/bin/env python3
"""
CAPS Overnight Batch OCR Seeder
Processes 19 missing subjects one at a time with resume capability
Optimized settings to prevent crashes
"""

import fitz  # PyMuPDF
import json
import re
import time
import traceback
from pathlib import Path
from datetime import datetime

# Configuration - OPTIMIZED for overnight stability
CONFIG = {
    'dpi': 150,  # Lower DPI = faster, less memory
    'max_pages': 20,  # Only first 20 pages (topics usually in first half)
    'batch_size': 1,  # Process 1 page at a time
    'save_interval': 1,  # Save after every PDF
    'sleep_between': 30,  # 30 second rest between PDFs (cooldown)
}

# Missing subjects with PDF mapping
SUBJECTS = [
    {"code": "10001014", "name": "English Home Language", "pdf": "CAPS FET _ HOME _ ENGLISH GR 10-12 _ WEB_5478.pdf"},
    {"code": "10001034", "name": "Life Sciences", "pdf": "CAPS FET _ LIFE SCIENCES _ GR 10-12 Web_2636.pdf"},
    {"code": "10001064", "name": "Physical Sciences", "pdf": "CAPS FET PHYSICAL SCIENCE WEB.pdf"},
    {"code": "10001094", "name": "Afrikaans Home Language", "pdf": "CAPS FET _ HOME _ AFRIKAANS GR 10-12 _ WEB_0544.PDF"},
    {"code": "10001114", "name": "Afrikaans First Additional Language", "pdf": "CAPS FET _ FAL _ AFRIKAANS GR 10-12 _ WEB_9455.pdf"},
    {"code": "10001204", "name": "Computer Applications Technology", "pdf": "CAPS FET _ COMPUTER APPLICATIONS TECHNOLOGY _ GR 10-12 _ Web_6AC6.pdf"},
    {"code": "10001234", "name": "Consumer Studies", "pdf": "CAPS FET _ Consumer Studies GR 10-12 _ WEB_C5DB.pdf"},
    {"code": "10001284", "name": "Engineering Graphics and Design", "pdf": "CAPS FET _ ENGINEERING GRAPICHS & DESIGN _ GR 10-12 _ Web_8899.pdf"},
    {"code": "10001324", "name": "English First Additional Language", "pdf": "CAPS FET _ FAL _ ENGLISH GR 10-12 _ WEB_65DC.pdf"},
    {"code": "10001404", "name": "Information Technology", "pdf": "CAPS FET _ INFORMATION TECHNOLOGY _ GR 10-12 _ Web_E677.pdf"},
    {"code": "10001424", "name": "Life Orientation", "pdf": "CAPS FET _ LIFE ORIENTATION _ GR 10-12 _ WEB_E6B3.pdf"},
    {"code": "10001524", "name": "Sepedi Home Language", "pdf": "CAPS FET _ HOME _ SEPEDI GR 10-12 _ WEB_9F5B.pdf"},
    {"code": "10001594", "name": "isiZulu Home Language", "pdf": "CAPS FET _ HOME _ ISIZULU GR 10-12 _ WEB_5D5A.pdf"},
    {"code": "10001614", "name": "isiXhosa Home Language", "pdf": "CAPS FET _ HOME _ ISIXHOSA GR 10-12 _ Web_9E70.pdf"},
    {"code": "10351054", "name": "Agricultural Sciences", "pdf": "CAPS FET _ AGRICULTURAL SCIENCE _ WEB_1CC4.pdf"},
    {"code": "11351084", "name": "Dramatic Arts", "pdf": "CAPS FET _ DRAMATIC ARTS _ GR 10-12 _ WEB_EA5E.pdf"},
    {"code": "11351124", "name": "Hospitality Studies", "pdf": "CAPS FET _ HOSPITALITY STUDIES _ GR 10-12 _ Web_2EA7.pdf"},
    {"code": "11351154", "name": "Music", "pdf": "CAPS FET _ MUSIC _ GR 10-12 _ Web_84B0.pdf"},
    {"code": "11351184", "name": "Visual Arts", "pdf": "CAPS FET _ VISUAL ARTS _ GR 10-12 _ WEB_A758.pdf"},
]

BASE_DIR = Path(r"C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents")
OUTPUT_DIR = Path(r"C:\dev\nsc-qbank\sandbox\overnight_results")
LOG_FILE = OUTPUT_DIR / "overnight_log.txt"
PROGRESS_FILE = OUTPUT_DIR / "progress.json"

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

def extract_text_from_pdf(pdf_path, max_pages=20, dpi=150):
    """Extract text using PyMuPDF (no OCR - faster)"""
    doc = fitz.open(pdf_path)
    all_text = []
    page_count = min(max_pages, len(doc))

    for page_num in range(page_count):
        page = doc[page_num]
        text = page.get_text()
        if text.strip():
            all_text.append({
                'page': page_num + 1,
                'text': text
            })

    doc.close()
    return all_text

def parse_topics_from_text(text_data, subject_name):
    """Parse topics and subtopics from extracted text"""
    topics = []
    current_topic = None

    for page_data in text_data:
        text = page_data['text']
        lines = text.split('\n')

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Look for topic patterns (numbered items, bold text, etc.)
            # This is a simplified parser - actual implementation would be more sophisticated
            if re.match(r'^\d+\.', line) or re.match(r'^Topic\s*\d+', line, re.IGNORECASE):
                if current_topic:
                    topics.append(current_topic)
                current_topic = {
                    'name': line,
                    'subtopics': [],
                    'page': page_data['page']
                }
            elif current_topic and len(line) > 10 and not line.startswith(' '):
                # Potential subtopic
                current_topic['subtopics'].append(line)

    if current_topic:
        topics.append(current_topic)

    return topics

def generate_sql_for_subject(subject, topics, topic_counter_start):
    """Generate SQL INSERT statements for a subject"""
    sql_lines = []
    topic_counter = topic_counter_start

    sql_lines.append(f"-- Subject: {subject['name']} ({subject['code']})")

    for i, topic in enumerate(topics, 1):
        topic_code = f"CAPS{topic_counter:04d}"
        topic_counter += 1

        topic_name = topic['name'].replace("'", "''")[:255]
        description = f"CAPS topic for {subject['name']} | Page: {topic['page']}"

        sql_lines.append(f"INSERT INTO lookup_caps_topics (")
        sql_lines.append(f"    subject_official_code, grade_number, strand, term,")
        sql_lines.append(f"    topic_code, topic_name, description, is_active, display_order")
        sql_lines.append(f") VALUES (")
        sql_lines.append(f"    '{subject['code']}', 10, 'General', '1',")
        sql_lines.append(f"    '{topic_code}', '{topic_name}', '{description}', 1, {i * 10}")
        sql_lines.append(f");")
        sql_lines.append(f"SET @topic_id = LAST_INSERT_ID();")

        for j, subtopic in enumerate(topic['subtopics'][:5], 1):  # Limit to 5 subtopics
            subtopic_name = subtopic.replace("'", "''")[:255]
            subtopic_code = f"{topic_code}_SUB{j:02d}"

            sql_lines.append(f"INSERT INTO lookup_caps_subtopics (")
            sql_lines.append(f"    topic_id, subtopic_code, subtopic_name, description, is_active, display_order")
            sql_lines.append(f") VALUES (")
            sql_lines.append(f"    @topic_id, '{subtopic_code}', '{subtopic_name}', 'CAPS subtopic', 1, {j * 10}")
            sql_lines.append(f");")

        sql_lines.append("")

    return sql_lines, topic_counter

def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    # Clear log for new run
    with open(LOG_FILE, 'w', encoding='utf-8') as f:
        f.write(f"CAPS Overnight Batch OCR Started: {datetime.now()}\n")
        f.write(f"Config: {json.dumps(CONFIG, indent=2)}\n")
        f.write("="*60 + "\n\n")

    progress = load_progress()
    log(f"Progress loaded: {len(progress['completed'])} completed, {len(progress['failed'])} failed")

    topic_counter = 96  # Start after existing topics
    all_sql = []

    for subject in SUBJECTS:
        subject_code = subject['code']
        subject_name = subject['name']
        pdf_name = subject['pdf']
        pdf_path = BASE_DIR / pdf_name

        if subject_code in progress['completed']:
            log(f"SKIP {subject_name} - already completed")
            continue

        if subject_code in progress['failed']:
            log(f"RETRY {subject_name} - previous failure")

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

            # Extract text
            log(f"Extracting text (max {CONFIG['max_pages']} pages, {CONFIG['dpi']} DPI)...")
            text_data = extract_text_from_pdf(str(pdf_path), CONFIG['max_pages'], CONFIG['dpi'])
            log(f"Extracted {len(text_data)} pages with text")

            # Parse topics
            log(f"Parsing topics...")
            topics = parse_topics_from_text(text_data, subject_name)
            log(f"Found {len(topics)} topics")

            if topics:
                # Generate SQL
                sql_lines, topic_counter = generate_sql_for_subject(subject, topics, topic_counter)
                all_sql.extend(sql_lines)

                # Save individual SQL file
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

            # Cooldown between PDFs
            log(f"Cooling down for {CONFIG['sleep_between']} seconds...")
            time.sleep(CONFIG['sleep_between'])

        except Exception as e:
            log(f"ERROR processing {subject_name}: {str(e)}")
            log(traceback.format_exc())
            progress['failed'].append(subject_code)
            save_progress(progress)

            # Longer cooldown after error
            log(f"Error cooldown: 60 seconds...")
            time.sleep(60)

    # Save combined SQL
    if all_sql:
        combined_sql = [
            "USE nsc_qbank;",
            "SET FOREIGN_KEY_CHECKS = 0;",
            "",
        ] + all_sql + [
            "",
            "SET FOREIGN_KEY_CHECKS = 1;",
        ]

        combined_file = OUTPUT_DIR / "combined_seed.sql"
        with open(combined_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(combined_sql))
        log(f"\nCombined SQL saved: {combined_file}")

    log(f"\n{'='*60}")
    log(f"BATCH COMPLETE")
    log(f"Completed: {len(progress['completed'])}/{len(SUBJECTS)}")
    log(f"Failed: {len(progress['failed'])}")
    log(f"{'='*60}")

if __name__ == '__main__':
    main()
