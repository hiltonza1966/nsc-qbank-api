#!/usr/bin/env python3
"""
Comprehensive CAPS Batch Parser - Phase 1: Topics + Subtopics
Processes all 19 remaining CAPS PDFs and extracts:
- Topics from "OVERVIEW OF TOPICS" table or term lists
- Subtopics with grade, hours, descriptions
- Generates SQL INSERT statements for lookup_caps_topics and lookup_caps_subtopics

Usage: python batch_caps_parser_v2.py <caps_folder_path>
"""

import fitz
import sys
import os
import re
import json
from datetime import datetime

# Subject mapping: filename pattern -> (subject_official_code, subject_alpha_code, subject_name, phase, grades)
SUBJECT_MAP = {
    "AFRIKAANS FIRST ADDITIONAL": ("10001114", "AFAL", "Afrikaans First Additional Language", "FET", "10-12"),
    "AFRIKAANS HOME": ("10001094", "AFHL", "Afrikaans Home Language", "FET", "10-12"),
    "AGRICULTURAL SCIENCES": ("10351054", "AGRI", "Agricultural Sciences", "FET", "10-12"),
    "COMPUTER APPLICATIONS TECHNOLOGY": ("10001204", "CATN", "Computer Applications Technology", "FET", "10-12"),
    "CONSUMER STUDIES": ("10001234", "CONS", "Consumer Studies", "FET", "10-12"),
    "DRAMATIC ARTS": ("11351084", "DRAM", "Dramatic Arts", "FET", "10-12"),
    "ENGINEERING GRAPHICS AND DESIGN": ("10001284", "EGDN", "Engineering Graphics and Design", "FET", "10-12"),
    "ENGLISH FIRST ADDITIONAL": ("10001324", "ENFL", "English First Additional Language", "FET", "10-12"),
    "ENGLISH HOME": ("10001014", "ENGL", "English Home Language", "FET", "10-12"),
    "HOSPITALITY STUDIES": ("11351124", "HTEL", "Hospitality Studies", "FET", "10-12"),
    "INFORMATION TECHNOLOGY": ("10001404", "INFT", "Information Technology", "FET", "10-12"),
    "ISIXHOSA HOME": ("10001614", "XHOS", "isiXhosa Home Language", "FET", "10-12"),
    "ISIZULU HOME": ("10001594", "ZULU", "isiZulu Home Language", "FET", "10-12"),
    "LIFE ORIENTATION": ("10001424", "LO", "Life Orientation", "FET", "10-12"),
    "LIFE SCIENCES": ("10001034", "LFSC", "Life Sciences", "FET", "10-12"),
    "MUSIC": ("11351154", "MUSI", "Music", "FET", "10-12"),
    "PHYSICAL SCIENCE": ("10001064", "PHYS", "Physical Sciences", "FET", "10-12"),
    "SEPEDI HOME": ("10001524", "SETH", "Sepedi Home Language", "FET", "10-12"),
    "VISUAL ARTS": ("11351184", "VSLA", "Visual Arts", "FET", "10-12"),
}

def identify_subject(filename):
    """Map filename to subject codes"""
    filename_upper = filename.upper()
    for key, codes in SUBJECT_MAP.items():
        if key in filename_upper:
            return codes
    return None

def extract_text_pages(pdf_path, start_page=1, end_page=50):
    """Extract text from page range"""
    doc = fitz.open(pdf_path)
    texts = []
    for i in range(start_page - 1, min(end_page, len(doc))):
        page = doc[i]
        texts.append(page.get_text())
    doc.close()
    return texts

def find_section_2_4_overview(texts):
    """Find the 'OVERVIEW OF TOPICS' section (Section 2.4)"""
    overview_pages = []
    in_overview = False

    for idx, text in enumerate(texts):
        text_upper = text.upper()

        # Detect start of overview
        if ("2.4" in text and "OVERVIEW" in text_upper and "TOPIC" in text_upper) or \
           ("OVERVIEW OF TOPICS" in text_upper) or \
           ("CONTENT OVERVIEW" in text_upper):
            in_overview = True
            overview_pages.append(text)
            continue

        if in_overview:
            # Check for end markers
            if any(marker in text_upper for marker in [
                "2.5", "OVERVIEW OF PRACTICAL WORK", "SECTION 3",
                "WEIGHTING OF TOPICS", "3.1", "GRADE 10", "TERM 1"
            ]):
                # Only stop if we've collected enough content
                if len(overview_pages) >= 2:
                    break
            overview_pages.append(text)

            # Safety: stop after 5 pages
            if len(overview_pages) > 5:
                break

    return overview_pages

def parse_physical_sciences_overview(overview_text, subject_codes):
    """Parse Physical Sciences specific overview format"""
    subject_official_code, subject_alpha_code, subject_name, phase, grades = subject_codes

    topics = []
    subtopics = []

    full_text = "\n".join(overview_text)
    lines = [l.strip() for l in full_text.split('\n') if l.strip()]

    # Physical Sciences has a specific table format
    # Topic | Grade 10 | Grade 11 | Grade 12
    # With content descriptions and hours

    current_topic = None
    current_topic_code = None
    topic_counter = 1
    subtopic_counter = 1

    i = 0
    while i < len(lines):
        line = lines[i]
        line_upper = line.upper()

        # Detect main topics (knowledge areas)
        # These are standalone lines before "Grade 10" or in the table
        topic_patterns = [
            "MECHANICS", "WAVES, SOUND AND LIGHT", "WAVES, SOUND & LIGHT",
            "ELECTRICITY AND MAGNETISM", "ELECTRICITY & MAGNETISM",
            "MATTER AND MATERIALS", "MATTER & MATERIALS",
            "CHEMICAL SYSTEMS", "CHEMICAL CHANGE",
            "SKILLS FOR PRACTICAL INVESTIGATIONS"
        ]

        for pattern in topic_patterns:
            if pattern in line_upper and len(line) < 60:
                current_topic = line.strip()
                current_topic_code = f"{subject_alpha_code}{topic_counter:02d}"

                topics.append({
                    "topic_code": current_topic_code,
                    "subject_official_code": subject_official_code,
                    "subject_alpha_code": subject_alpha_code,
                    "subject_name": subject_name,
                    "topic_name": current_topic,
                    "grade_number": None,
                    "strand": subject_name,
                    "term": None,
                    "topic_weighting": None,
                    "time_weeks": None,
                    "paper_no": None,
                    "description": "",
                    "is_active": 1,
                    "display_order": topic_counter
                })
                topic_counter += 1
                subtopic_counter = 1
                break

        # Detect grade markers
        grade_match = re.search(r'Grade\s*(10|11|12)', line, re.IGNORECASE)
        if grade_match and current_topic and topics:
            grade = int(grade_match.group(1))
            # Update the last topic with this grade
            # But we need separate topics per grade, so create a new one
            last_topic = topics[-1]
            if last_topic["grade_number"] is None:
                last_topic["grade_number"] = grade
            else:
                # Create a new topic entry for this grade
                new_topic = last_topic.copy()
                new_topic["topic_code"] = f"{subject_alpha_code}{topic_counter-1:02d}G{grade}"
                new_topic["grade_number"] = grade
                new_topic["display_order"] = topic_counter
                topics.append(new_topic)
                topic_counter += 1

        # Detect subtopic content (lines with descriptions after grade markers)
        # Look for content in parentheses or after colons
        if current_topic and len(line) > 15 and not line.isupper():
            # Check if this is a content description line
            has_content = any(marker in line for marker in [';', ',', '(', ')', 'reference', 'displacement', 'energy', 'force', 'wave', 'atom', 'molecule'])
            if has_content and not re.match(r'^(Grade|Section|\d+\.\d+|CAPS|PHYSICAL)', line, re.IGNORECASE):
                subtopic_code = f"{current_topic_code}{subtopic_counter:02d}" if current_topic_code else f"{subject_alpha_code}UNK{subtopic_counter:02d}"
                subtopics.append({
                    "subtopic_code": subtopic_code,
                    "topic_code": current_topic_code,
                    "subtopic_name": line[:100],
                    "description": line,
                    "grade_number": grade if 'grade' in dir() else None,
                    "is_active": 1,
                    "display_order": subtopic_counter
                })
                subtopic_counter += 1

        i += 1

    return topics, subtopics

def parse_generic_overview(overview_text, subject_codes):
    """Generic parser for subjects with different formats"""
    subject_official_code, subject_alpha_code, subject_name, phase, grades = subject_codes

    topics = []
    subtopics = []

    full_text = "\n".join(overview_text)
    lines = [l.strip() for l in full_text.split('\n') if l.strip()]

    current_topic = None
    current_topic_code = None
    topic_counter = 1
    subtopic_counter = 1
    current_grade = None

    for line in lines:
        line_upper = line.upper()

        # Skip header/footer lines
        if any(skip in line_upper for skip in ['CAPS', 'CURRICULUM', 'SECTION', 'CONTENTS', 'PAGE']):
            if len(line) < 50:
                continue

        # Detect grade markers
        grade_match = re.search(r'Grade\s*(10|11|12)', line, re.IGNORECASE)
        if grade_match:
            current_grade = int(grade_match.group(1))
            continue

        # Detect topic names (capitalized, standalone, reasonable length)
        if re.match(r'^[A-Z][A-Za-z\s,&/-]+$', line) and 5 < len(line) < 60:
            # Check if next few lines have grade or content info
            current_topic = line.strip()
            current_topic_code = f"{subject_alpha_code}{topic_counter:02d}"

            topics.append({
                "topic_code": current_topic_code,
                "subject_official_code": subject_official_code,
                "subject_alpha_code": subject_alpha_code,
                "subject_name": subject_name,
                "topic_name": current_topic,
                "grade_number": current_grade,
                "strand": subject_name,
                "term": None,
                "topic_weighting": None,
                "time_weeks": None,
                "paper_no": None,
                "description": "",
                "is_active": 1,
                "display_order": topic_counter
            })
            topic_counter += 1
            subtopic_counter = 1
            continue

        # Detect subtopic descriptions (longer lines with content)
        if current_topic and len(line) > 20 and not line.isupper():
            # Check for content markers
            content_markers = [';', ',', '(', ')', 'and', 'the', 'of', 'in']
            if any(m in line.lower() for m in content_markers[:3]):
                subtopic_code = f"{current_topic_code}{subtopic_counter:02d}" if current_topic_code else f"{subject_alpha_code}UNK{subtopic_counter:02d}"
                subtopics.append({
                    "subtopic_code": subtopic_code,
                    "topic_code": current_topic_code,
                    "subtopic_name": line[:100],
                    "description": line,
                    "grade_number": current_grade,
                    "is_active": 1,
                    "display_order": subtopic_counter
                })
                subtopic_counter += 1

    return topics, subtopics

def parse_overview(overview_text, subject_codes):
    """Route to appropriate parser based on subject"""
    _, subject_alpha_code, _, _, _ = subject_codes

    if subject_alpha_code == "PHYS":
        return parse_physical_sciences_overview(overview_text, subject_codes)
    else:
        return parse_generic_overview(overview_text, subject_codes)

def generate_sql(topics, subtopics, subject_codes):
    """Generate SQL INSERT statements"""
    subject_official_code, subject_alpha_code, subject_name, phase, grades = subject_codes

    sql_lines = []
    sql_lines.append(f"-- CAPS Import for {subject_name} ({subject_alpha_code})")
    sql_lines.append(f"-- Generated: {datetime.now().isoformat()}")
    sql_lines.append("")
    sql_lines.append("USE nsc_qbank;")
    sql_lines.append("")

    if not topics:
        sql_lines.append("-- NO TOPICS FOUND")
        return "\n".join(sql_lines)

    # Topics INSERT
    sql_lines.append("INSERT INTO lookup_caps_topics ")
    sql_lines.append("(subject_official_code, grade_number, strand, term, topic_code, topic_name, topic_weighting, time_weeks, paper_no, description, is_active, display_order)")
    sql_lines.append("VALUES")

    topic_values = []
    for t in topics:
        grade = t['grade_number'] if t['grade_number'] else 'NULL'
        term = f"'{t['term']}'" if t['term'] else 'NULL'
        weight = t['topic_weighting'] if t['topic_weighting'] else 'NULL'
        time_w = t['time_weeks'] if t['time_weeks'] else 'NULL'
        paper = t['paper_no'] if t['paper_no'] else 'NULL'
        desc = t['description'].replace("'", "''") if t['description'] else ''

        val = f"    ('{t['subject_official_code']}', {grade}, '{t['strand']}', {term}, '{t['topic_code']}', '{t['topic_name'].replace(chr(39), chr(39)+chr(39))}', {weight}, {time_w}, {paper}, '{desc}', 1, {t['display_order']})"
        topic_values.append(val)

    sql_lines.append(",\n".join(topic_values) + ";")
    sql_lines.append("")

    # Subtopics INSERT
    if subtopics:
        sql_lines.append("-- Subtopics (insert after topics to get topic_id)")
        sql_lines.append("-- Use topic_code to lookup topic_id first")
        sql_lines.append("")
        sql_lines.append("-- Example: INSERT INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, description, is_active, display_order)")
        sql_lines.append("-- SELECT t.topic_id, 'SUBCODE', 'Subtopic Name', 'Description', 1, 1")
        sql_lines.append("-- FROM lookup_caps_topics t WHERE t.topic_code = 'TOPIC_CODE';")
        sql_lines.append("")

        for s in subtopics:
            sql_lines.append(f"-- Subtopic: {s['subtopic_code']} -> Topic: {s['topic_code']}")
            sql_lines.append(f"--   Name: {s['subtopic_name'][:60]}")

    return "\n".join(sql_lines)

def process_single_pdf(pdf_path):
    """Process a single CAPS PDF"""
    filename = os.path.basename(pdf_path)
    subject_codes = identify_subject(filename)

    if not subject_codes:
        print(f"  ⚠ SKIP: Could not identify subject for: {filename}")
        return None

    subject_official_code, subject_alpha_code, subject_name, phase, grades = subject_codes
    print(f"  Processing: {filename} -> {subject_name} ({subject_alpha_code})")

    # Extract text from pages 10-30 (where overview usually is)
    texts = extract_text_pages(pdf_path, 10, 30)

    # Find overview section
    overview = find_section_2_4_overview(texts)
    if not overview:
        print(f"    ⚠ No 'OVERVIEW OF TOPICS' found, trying broader search...")
        # Try broader search
        texts = extract_text_pages(pdf_path, 1, 40)
        overview = find_section_2_4_overview(texts)
        if not overview:
            print(f"    ✗ Still no overview found")
            return None

    print(f"    Found overview across {len(overview)} pages")

    # Parse topics and subtopics
    topics, subtopics = parse_overview(overview, subject_codes)

    print(f"    ✓ Extracted {len(topics)} topics, {len(subtopics)} subtopics")

    # Generate SQL
    sql = generate_sql(topics, subtopics, subject_codes)

    return {
        "subject": subject_name,
        "subject_alpha_code": subject_alpha_code,
        "subject_official_code": subject_official_code,
        "topics": topics,
        "subtopics": subtopics,
        "sql": sql,
        "overview_pages": len(overview)
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: python batch_caps_parser_v2.py <caps_folder_path>")
        print("Example: python batch_caps_parser_v2.py \"C:/Users/.../CAPS Documents\"")
        sys.exit(1)

    folder_path = sys.argv[1]

    if not os.path.exists(folder_path):
        print(f"Error: Folder not found: {folder_path}")
        sys.exit(1)

    # Find all PDFs in the main folder only (NOT subfolders)
    pdf_files = [f for f in os.listdir(folder_path) 
                 if f.lower().endswith('.pdf') and os.path.isfile(os.path.join(folder_path, f))]
    pdf_files.sort()

    print(f"Found {len(pdf_files)} PDF files in {folder_path}")
    print("=" * 70)

    results = []
    skipped = []

    for pdf_file in pdf_files:
        pdf_path = os.path.join(folder_path, pdf_file)
        print(f"\n[{len(results)+len(skipped)+1}/{len(pdf_files)}] {pdf_file}")

        result = process_single_pdf(pdf_path)
        if result:
            results.append(result)

            # Save individual SQL file
            sql_filename = f"caps_import_{result['subject_alpha_code'].lower()}.sql"
            sql_path = os.path.join(folder_path, sql_filename)
            with open(sql_path, 'w', encoding='utf-8') as f:
                f.write(result['sql'])
            print(f"    ✓ Saved SQL: {sql_filename}")
        else:
            skipped.append(pdf_file)

    # Save combined results as JSON
    json_path = os.path.join(folder_path, "batch_caps_results_v2.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump({
            "processed": results,
            "skipped": skipped,
            "timestamp": datetime.now().isoformat()
        }, f, indent=2, default=str)

    print(f"\n{'='*70}")
    print(f"BATCH COMPLETE")
    print(f"{'='*70}")
    print(f"Processed: {len(results)}/{len(pdf_files)} PDFs")
    print(f"Skipped: {len(skipped)} PDFs")
    if skipped:
        print(f"Skipped files: {', '.join(skipped)}")

    # Summary table
    print(f"\n{'='*70}")
    print(f"{'CODE':<6} | {'SUBJECT':<35} | {'TOPICS':<6} | {'SUBTOPICS':<9} | {'PAGES':<5}")
    print(f"{'-'*70}")
    total_topics = 0
    total_subtopics = 0
    for r in results:
        print(f"{r['subject_alpha_code']:<6} | {r['subject']:<35} | {len(r['topics']):<6} | {len(r['subtopics']):<9} | {r['overview_pages']:<5}")
        total_topics += len(r['topics'])
        total_subtopics += len(r['subtopics'])
    print(f"{'-'*70}")
    print(f"TOTAL  | {'':<35} | {total_topics:<6} | {total_subtopics:<9} |")
    print(f"\nResults saved to: {json_path}")

if __name__ == "__main__":
    main()
