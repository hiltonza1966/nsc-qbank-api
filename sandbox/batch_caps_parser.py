#!/usr/bin/env python3
"""
Universal CAPS Batch Parser
Processes all CAPS PDFs in a folder and extracts:
1. Topics from "OVERVIEW OF TOPICS" table (Section 2.4)
2. Subtopics from the same table
3. Weightings and time allocations
4. Generates SQL INSERT statements for lookup_caps_topics and lookup_caps_subtopics

Usage: python batch_caps_parser.py <caps_folder_path>
"""

import fitz  # pymupdf
import sys
import os
import re
import json
from datetime import datetime

# Subject mapping: filename pattern -> subject_official_code, subject_alpha_code, subject_name
SUBJECT_MAP = {
    "AFRIKAANS FIRST ADDITIONAL": ("10001114", "AFAL", "Afrikaans First Additional Language"),
    "AFRIKAANS HOME": ("10001094", "AFHL", "Afrikaans Home Language"),
    "AGRICULTURAL SCIENCES": ("10351054", "AGRI", "Agricultural Sciences"),
    "COMPUTER APPLICATIONS TECHNOLOGY": ("10001204", "CATN", "Computer Applications Technology"),
    "CONSUMER STUDIES": ("10001234", "CONS", "Consumer Studies"),
    "DRAMATIC ARTS": ("11351084", "DRAM", "Dramatic Arts"),
    "ENGINEERING GRAPHICS AND DESIGN": ("10001284", "EGDN", "Engineering Graphics and Design"),
    "ENGLISH FIRST ADDITIONAL": ("10001324", "ENFL", "English First Additional Language"),
    "ENGLISH HOME": ("10001014", "ENGL", "English Home Language"),
    "HOSPITALITY STUDIES": ("11351124", "HTEL", "Hospitality Studies"),
    "INFORMATION TECHNOLOGY": ("10001404", "INFT", "Information Technology"),
    "ISIXHOSA HOME": ("10001614", "XHOS", "isiXhosa Home Language"),
    "ISIZULU HOME": ("10001594", "ZULU", "isiZulu Home Language"),
    "LIFE ORIENTATION": ("10001424", "LO", "Life Orientation"),
    "LIFE SCIENCES": ("10001034", "LFSC", "Life Sciences"),
    "MATHEMATICAL LITERACY": ("10001474", "MLIT", "Mathematical Literacy"),
    "MATHEMATICS": ("10001044", "MATH", "Mathematics"),
    "MUSIC": ("11351154", "MUSI", "Music"),
    "PHYSICAL SCIENCE": ("10001064", "PHYS", "Physical Sciences"),
    "SEPEDI HOME": ("10001524", "SETH", "Sepedi Home Language"),
    "TECHNICAL MATHEMATICS": ("10001634", "TMAT", "Technical Mathematics"),
    "TECHNICAL SCIENCES": ("10001654", "TECH", "Technical Sciences"),
    "VISUAL ARTS": ("11351184", "VSLA", "Visual Arts"),
    "ACCOUNTING": ("10001024", "ACCN", "Accounting"),
    "BUSINESS STUDIES": ("10001164", "BUSN", "Business Studies"),
    "ECONOMICS": ("10001264", "ECON", "Economics"),
    "GEOGRAPHY": ("10001354", "GEOG", "Geography"),
    "HISTORY": ("10001374", "HIST", "History"),
    "TOURISM": ("10001584", "TOUR", "Tourism"),
}

def identify_subject(filename):
    """Map filename to subject codes"""
    filename_upper = filename.upper()
    for key, codes in SUBJECT_MAP.items():
        if key in filename_upper:
            return codes
    return None

def extract_text_from_pdf(pdf_path, start_page=1, end_page=30):
    """Extract text from page range"""
    doc = fitz.open(pdf_path)
    texts = []
    for i in range(start_page - 1, min(end_page, len(doc))):
        page = doc[i]
        texts.append(page.get_text())
    doc.close()
    return texts

def find_overview_of_topics(texts):
    """Find the 'OVERVIEW OF TOPICS' section across pages"""
    overview_pages = []
    in_overview = False

    for idx, text in enumerate(texts):
        if "OVERVIEW OF TOPICS" in text.upper() or "2.4" in text and "OVERVIEW" in text.upper():
            in_overview = True
        if in_overview:
            overview_pages.append(text)
            # Stop when we hit next major section or practical work
            if "2.5" in text or "OVERVIEW OF PRACTICAL WORK" in text.upper():
                break
            if "SECTION 3" in text.upper():
                break
            if idx > 0 and "WEIGHTING OF TOPICS" in text.upper():
                break

    return overview_pages

def parse_topics_from_overview(overview_text, subject_codes):
    """Parse topic/subtopic structure from overview text"""
    subject_official_code, subject_alpha_code, subject_name = subject_codes

    topics = []
    subtopics = []

    # Clean and normalize text
    full_text = "\n".join(overview_text)
    lines = [l.strip() for l in full_text.split('\n') if l.strip()]

    # Try to identify topic patterns
    # Common patterns: "Mechanics", "Waves, Sound & Light", etc.
    # Topics are usually followed by "Grade 10", "Grade 11", "Grade 12"

    current_topic = None
    current_grade = None
    topic_counter = 1
    subtopic_counter = 1

    for i, line in enumerate(lines):
        # Detect topic names (usually capitalized, standalone, before grade markers)
        if re.match(r'^[A-Z][A-Za-z\s,&]+$', line) and len(line) > 3 and len(line) < 60:
            # Check if next line has grade info
            if i + 1 < len(lines) and "Grade" in lines[i + 1]:
                current_topic = line.strip()
                topic_code = f"{subject_alpha_code}{topic_counter:02d}"

                topics.append({
                    "topic_code": topic_code,
                    "subject_official_code": subject_official_code,
                    "subject_alpha_code": subject_alpha_code,
                    "subject_name": subject_name,
                    "topic_name": current_topic,
                    "grade_number": None,  # Will be set per grade
                    "strand": subject_name,
                    "term": None,
                    "topic_weighting": None,
                    "time_weeks": None,
                    "paper_no": None,
                    "description": "",
                    "display_order": topic_counter
                })
                topic_counter += 1
                subtopic_counter = 1

        # Detect grade markers
        grade_match = re.search(r'Grade\s*(10|11|12)', line, re.IGNORECASE)
        if grade_match and current_topic:
            current_grade = int(grade_match.group(1))
            # Update the last topic with grade info
            if topics:
                topics[-1]["grade_number"] = current_grade

        # Detect subtopic content (lines with content descriptions after grade)
        if current_topic and current_grade and len(line) > 20 and not line.isupper():
            # This might be a subtopic description
            subtopic_code = f"{subject_alpha_code}{topic_counter-1:02d}{subtopic_counter:02d}"
            subtopics.append({
                "subtopic_code": subtopic_code,
                "topic_code": topics[-1]["topic_code"] if topics else None,
                "subtopic_name": line[:100],  # Truncate for name
                "description": line,
                "grade_number": current_grade,
                "display_order": subtopic_counter
            })
            subtopic_counter += 1

    return topics, subtopics

def generate_sql_insert(topics, subtopics, subject_codes):
    """Generate SQL INSERT statements"""
    subject_official_code, subject_alpha_code, subject_name = subject_codes

    sql_lines = []
    sql_lines.append(f"-- CAPS Import for {subject_name} ({subject_alpha_code})")
    sql_lines.append(f"-- Generated: {datetime.now().isoformat()}")
    sql_lines.append("")
    sql_lines.append("USE nsc_qbank;")
    sql_lines.append("")

    # Topics INSERT
    sql_lines.append("-- Insert Topics")
    sql_lines.append("INSERT INTO lookup_caps_topics ")
    sql_lines.append("(subject_official_code, grade_number, strand, term, topic_code, topic_name, topic_weighting, time_weeks, paper_no, description, is_active, display_order)")
    sql_lines.append("VALUES")

    topic_values = []
    for t in topics:
        val = f"    ('{t['subject_official_code']}', {t['grade_number'] or 'NULL'}, '{t['strand']}', {t['term'] or 'NULL'}, '{t['topic_code']}', '{t['topic_name'].replace(chr(39), chr(39)+chr(39))}', {t['topic_weighting'] or 'NULL'}, {t['time_weeks'] or 'NULL'}, {t['paper_no'] or 'NULL'}, '{t['description'].replace(chr(39), chr(39)+chr(39))}', 1, {t['display_order']})"
        topic_values.append(val)

    sql_lines.append(",\n".join(topic_values) + ";")
    sql_lines.append("")

    # Subtopics INSERT (requires topic_id from DB, so we use a placeholder approach)
    sql_lines.append("-- Subtopics will be inserted after topics are committed")
    sql_lines.append("-- Use the following mapping to link subtopics to topics:")
    sql_lines.append("-- topic_code -> topic_id lookup required")
    sql_lines.append("")

    return "\n".join(sql_lines)

def process_single_pdf(pdf_path):
    """Process a single CAPS PDF"""
    filename = os.path.basename(pdf_path)
    subject_codes = identify_subject(filename)

    if not subject_codes:
        print(f"  ⚠ Could not identify subject for: {filename}")
        return None

    subject_official_code, subject_alpha_code, subject_name = subject_codes
    print(f"  Processing: {filename} -> {subject_name} ({subject_alpha_code})")

    # Extract text from pages 10-25 (where overview usually is)
    texts = extract_text_from_pdf(pdf_path, 10, 25)

    # Find overview section
    overview = find_overview_of_topics(texts)
    if not overview:
        print(f"    ⚠ No 'OVERVIEW OF TOPICS' found")
        return None

    # Parse topics and subtopics
    topics, subtopics = parse_topics_from_overview(overview, subject_codes)

    print(f"    ✓ Found {len(topics)} topics, {len(subtopics)} subtopics")

    # Generate SQL
    sql = generate_sql_insert(topics, subtopics, subject_codes)

    return {
        "subject": subject_name,
        "subject_alpha_code": subject_alpha_code,
        "topics": topics,
        "subtopics": subtopics,
        "sql": sql
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: python batch_caps_parser.py <caps_folder_path>")
        print("Example: python batch_caps_parser.py \"C:/Users/visagie.h/Downloads/GIA PROTOCOL START FILES/Qbank/CAPS Documents\"")
        sys.exit(1)

    folder_path = sys.argv[1]

    if not os.path.exists(folder_path):
        print(f"Error: Folder not found: {folder_path}")
        sys.exit(1)

    # Find all PDFs
    pdf_files = [f for f in os.listdir(folder_path) if f.lower().endswith('.pdf')]
    pdf_files.sort()

    print(f"Found {len(pdf_files)} PDF files in {folder_path}")
    print("=" * 70)

    results = []

    for pdf_file in pdf_files:
        pdf_path = os.path.join(folder_path, pdf_file)
        print(f"\n[{len(results)+1}/{len(pdf_files)}] {pdf_file}")

        result = process_single_pdf(pdf_path)
        if result:
            results.append(result)

            # Save individual SQL file
            sql_filename = f"caps_import_{result['subject_alpha_code'].lower()}.sql"
            sql_path = os.path.join(folder_path, sql_filename)
            with open(sql_path, 'w', encoding='utf-8') as f:
                f.write(result['sql'])
            print(f"    ✓ Saved SQL: {sql_filename}")

    # Save combined results as JSON
    json_path = os.path.join(folder_path, "batch_caps_results.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n{'='*70}")
    print(f"Batch complete: {len(results)}/{len(pdf_files)} PDFs processed")
    print(f"Results saved to: {json_path}")

    # Summary
    print(f"\n{'='*70}")
    print("SUMMARY:")
    print(f"{'='*70}")
    total_topics = sum(len(r['topics']) for r in results)
    total_subtopics = sum(len(r['subtopics']) for r in results)
    print(f"Total subjects processed: {len(results)}")
    print(f"Total topics extracted: {total_topics}")
    print(f"Total subtopics extracted: {total_subtopics}")

    for r in results:
        print(f"  {r['subject_alpha_code']:6s} | {r['subject']:35s} | {len(r['topics']):3d} topics | {len(r['subtopics']):3d} subtopics")

if __name__ == "__main__":
    main()
