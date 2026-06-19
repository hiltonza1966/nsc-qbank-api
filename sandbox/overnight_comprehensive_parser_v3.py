#!/usr/bin/env python3
"""
CAPS Comprehensive PDF Parser - v3
Extracts ALL fields from CAPS PDFs matching Excel structure:
- topic_name, subtopic_name, grade_number, term, time_weeks, caps_ref
- Plus generated: strand, topic_code, subtopic_code, description
"""

import fitz  # PyMuPDF
import re
import json
import time
import traceback
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Configuration
CONFIG = {
    'dpi': 150,
    'max_pages': 30,  # CAPS topics usually in first 30 pages
    'sleep_between': 15,
}

# Missing subjects with PDF mapping and strand inference
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
OUTPUT_DIR = Path(r"C:\dev\nsc-qbank\sandbox\overnight_results")
LOG_FILE = OUTPUT_DIR / "comprehensive_parser_log.txt"
PROGRESS_FILE = OUTPUT_DIR / "comprehensive_progress.json"

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

def extract_text_from_pdf(pdf_path, max_pages=30):
    """Extract text from PDF using PyMuPDF"""
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

def parse_caps_comprehensive(text_data, subject_name):
    """
    Comprehensive parser that extracts ALL fields:
    - topic_name (from Section 3 headers)
    - subtopic_name (from sub-topic lists)
    - grade_number (from Grade 10/11/12 indicators)
    - term (from Term 1/2/3/4 indicators)
    - time_weeks (from Week/Time indicators)
    - caps_ref (from CAPS reference numbers)
    """
    topics = []
    current_topic = None
    in_section_3 = False
    section_3_start_page = None

    for page_data in text_data:
        text = page_data['text']
        lines = text.split('\n')

        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue

            # Detect Section 3 start
            if re.search(r'Section\s*3[:\.\s]*Content', line, re.IGNORECASE):
                in_section_3 = True
                section_3_start_page = page_data['page']
                log(f"  Found Section 3 at page {page_data['page']}")
                continue

            # Detect Section 4 (end of Section 3)
            if re.search(r'Section\s*4[:\.\s]', line, re.IGNORECASE):
                in_section_3 = False
                log(f"  End of Section 3 at page {page_data['page']}")
                continue

            if not in_section_3:
                continue

            # Detect topic headers (3.1, 3.2, 3.3, etc.)
            topic_match = re.match(r'^3\.(\d+)\s+(.+)', line)
            if topic_match:
                topic_num = topic_match.group(1)
                topic_name = topic_match.group(2).strip()

                # Save previous topic
                if current_topic:
                    topics.append(current_topic)

                current_topic = {
                    'number': topic_num,
                    'name': topic_name,
                    'subtopics': [],
                    'grades': set(),
                    'terms': set(),
                    'weeks': set(),
                    'caps_refs': set(),
                    'page': page_data['page']
                }
                log(f"  Found topic: {topic_name}")
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

                # Extract CAPS reference numbers
                caps_matches = re.findall(r'CAPS\s*([A-Z]?\d+[a-z]?)', line, re.IGNORECASE)
                for caps in caps_matches:
                    current_topic['caps_refs'].add(caps)

                # Extract subtopics (bullet points, numbered items, or specific patterns)
                subtopic_match = re.match(r'^[\-\•\*\◦\▪]\s*(.+)', line)
                if not subtopic_match:
                    subtopic_match = re.match(r'^\d+\.\s+(.+)', line)
                if not subtopic_match:
                    # Check for subtopic indicators like "Sub-topic" or "Content"
                    subtopic_match = re.match(r'^(?:Sub[-\s]?topic|Content|Concept|Skill)[\s:]*(.+)', line, re.IGNORECASE)

                if subtopic_match:
                    subtopic_name = subtopic_match.group(1).strip()
                    # Filter out short lines and page numbers
                    if len(subtopic_name) > 10 and not re.match(r'^\d+$', subtopic_name):
                        # Avoid duplicates
                        if subtopic_name not in current_topic['subtopics']:
                            current_topic['subtopics'].append(subtopic_name)

    # Save last topic
    if current_topic:
        topics.append(current_topic)

    return topics

def generate_sql_for_subject(subject, topics, topic_counter_start):
    """Generate SQL INSERT statements with ALL fields populated"""
    sql_lines = []
    topic_counter = topic_counter_start

    sql_lines.append(f"-- Subject: {subject['name']} ({subject['code']})")
    sql_lines.append(f"-- Strand: {subject['strand']}")

    for i, topic in enumerate(topics, 1):
        topic_code = f"CAPS{topic_counter:04d}"
        topic_counter += 1

        topic_name = topic['name'].replace("'", "''")[:255]

        # Extract grade_number from grades set
        grades_list = sorted(topic['grades'])
        grade_number = grades_list[0] if grades_list else 'NULL'
        if grade_number != 'NULL':
            try:
                grade_number = int(grade_number)
            except:
                grade_number = 'NULL'

        # Extract term
        terms_list = sorted(topic['terms'])
        term = str(terms_list[0]) if terms_list else 'NULL'
        if term != 'NULL':
            term = f"'{term}'"

        # Extract time_weeks
        weeks_list = sorted(topic['weeks'])
        time_weeks = weeks_list[0] if weeks_list else 'NULL'
        if time_weeks != 'NULL':
            try:
                time_weeks = int(time_weeks)
            except:
                time_weeks = 'NULL'

        # Extract caps_refs
        caps_refs = sorted(topic['caps_refs'])

        # Generate description
        description = f"CAPS topic for {subject['name']}"
        if grades_list:
            description += f" | Grades: {', '.join(grades_list)}"
        if terms_list:
            description += f" | Terms: {', '.join(terms_list)}"
        if weeks_list:
            description += f" | Weeks: {', '.join(weeks_list)}"
        if caps_refs:
            refs = ', '.join(caps_refs)[:100]
            description += f" | Ref: {refs}"
        description = description.replace("'", "''")[:500]

        # Strand
        strand = f"'{subject['strand']}'"

        sql_lines.append(f"")
        sql_lines.append(f"-- Topic {topic['number']}: {topic_name}")
        sql_lines.append(f"INSERT INTO lookup_caps_topics (")
        sql_lines.append(f"    subject_official_code,")
        sql_lines.append(f"    grade_id,")
        sql_lines.append(f"    grade_number,")
        sql_lines.append(f"    strand,")
        sql_lines.append(f"    term,")
        sql_lines.append(f"    topic_code,")
        sql_lines.append(f"    topic_name,")
        sql_lines.append(f"    topic_weighting,")
        sql_lines.append(f"    time_weeks,")
        sql_lines.append(f"    paper_no,")
        sql_lines.append(f"    description,")
        sql_lines.append(f"    is_active,")
        sql_lines.append(f"    display_order")
        sql_lines.append(f") VALUES (")
        sql_lines.append(f"    '{subject['code']},")
        sql_lines.append(f"    NULL,")
        sql_lines.append(f"    {grade_number},")
        sql_lines.append(f"    {strand},")
        sql_lines.append(f"    {term},")
        sql_lines.append(f"    '{topic_code}',")
        sql_lines.append(f"    '{topic_name}',")
        sql_lines.append(f"    NULL,")
        sql_lines.append(f"    {time_weeks},")
        sql_lines.append(f"    NULL,")
        sql_lines.append(f"    '{description}',")
        sql_lines.append(f"    1,")
        sql_lines.append(f"    {i * 10}")
        sql_lines.append(f");")
        sql_lines.append(f"SET @topic_id = LAST_INSERT_ID();")
        sql_lines.append(f"")

        # Subtopics
        for j, subtopic in enumerate(topic['subtopics'][:15], 1):  # Limit to 15 subtopics
            subtopic_name = subtopic.replace("'", "''")[:255]
            subtopic_code = re.sub(r'[^a-zA-Z0-9]', '_', subtopic[:20]).upper()

            subtopic_description = f"CAPS subtopic for {subject['name']} | Topic: {topic_name}"
            subtopic_description = subtopic_description.replace("'", "''")[:500]

            sql_lines.append(f"INSERT INTO lookup_caps_subtopics (")
            sql_lines.append(f"    topic_id,")
            sql_lines.append(f"    subtopic_code,")
            sql_lines.append(f"    subtopic_name,")
            sql_lines.append(f"    description,")
            sql_lines.append(f"    is_active,")
            sql_lines.append(f"    display_order")
            sql_lines.append(f") VALUES (")
            sql_lines.append(f"    @topic_id,")
            sql_lines.append(f"    '{subtopic_code}',")
            sql_lines.append(f"    '{subtopic_name}',")
            sql_lines.append(f"    '{subtopic_description}',")
            sql_lines.append(f"    1,")
            sql_lines.append(f"    {j * 10}")
            sql_lines.append(f");")

        sql_lines.append("")

    return sql_lines, topic_counter

def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    with open(LOG_FILE, 'w', encoding='utf-8') as f:
        f.write(f"CAPS Comprehensive Parser Started: {datetime.now()}\n")
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

            log(f"Extracting text (max {CONFIG['max_pages']} pages)...")
            text_data = extract_text_from_pdf(str(pdf_path), CONFIG['max_pages'])
            log(f"Extracted {len(text_data)} pages with text")

            log(f"Parsing CAPS structure...")
            topics = parse_caps_comprehensive(text_data, subject_name)

            total_subtopics = sum(len(t['subtopics']) for t in topics)
            log(f"Found {len(topics)} topics with {total_subtopics} subtopics")

            if topics:
                # Show sample of what was found
                for t in topics[:3]:
                    log(f"  Topic: {t['name']}")
                    log(f"    Grades: {sorted(t['grades'])}, Terms: {sorted(t['terms'])}, Weeks: {sorted(t['weeks'])}")
                    log(f"    Subtopics: {len(t['subtopics'])}")

                sql_lines, topic_counter = generate_sql_for_subject(subject, topics, topic_counter)
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

            log(f"Cooling down for {CONFIG['sleep_between']} seconds...")
            time.sleep(CONFIG['sleep_between'])

        except Exception as e:
            log(f"ERROR processing {subject_name}: {str(e)}")
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

        combined_file = OUTPUT_DIR / "combined_comprehensive_seed.sql"
        with open(combined_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(combined_sql))
        log(f"\nCombined SQL saved: {combined_file}")

    log(f"\n{'='*60}")
    log(f"PARSER COMPLETE")
    log(f"Completed: {len(progress['completed'])}/{len(SUBJECTS)}")
    log(f"Failed: {len(progress['failed'])}")
    log(f"{'='*60}")

if __name__ == '__main__':
    main()
