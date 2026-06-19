#!/usr/bin/env python3
"""
CAPS Batch Parser V4 - Final Cleanup
- Better topic detection (filters out noise)
- Physical Sciences specific fix
- Subtopic insertion with topic_id lookup
- Grade-based topic grouping
"""

import fitz
import sys
import os
import re
import json
from datetime import datetime

SUBJECT_MAP = {
    "CAPS FET PHYSICAL SCIENCE WEB.pdf": ("10001064", "PHYS", "Physical Sciences", "FET", "10-12"),
    "CAPS FET _ AGRICULTURAL SCIENCE _ WEB_1CC4.pdf": ("10351054", "AGRI", "Agricultural Sciences", "FET", "10-12"),
    "CAPS FET _ COMPUTER APPLICATIONS TECHNOLOGY _ GR 10-12 _ Web_6AC6.pdf": ("10001204", "CATN", "Computer Applications Technology", "FET", "10-12"),
    "CAPS FET _ Consumer Studies GR 10-12 _ WEB_C5DB.pdf": ("10001234", "CONS", "Consumer Studies", "FET", "10-12"),
    "CAPS FET _ DRAMATIC ARTS _ GR 10-12 _ WEB_EA5E.pdf": ("11351084", "DRAM", "Dramatic Arts", "FET", "10-12"),
    "CAPS FET _ HOSPITALITY STUDIES _ GR 10-12 _ Web_2EA7.pdf": ("11351124", "HTEL", "Hospitality Studies", "FET", "10-12"),
    "CAPS FET _ INFORMATION TECHNOLOGY _ GR 10-12 _ Web_E677.pdf": ("10001404", "INFT", "Information Technology", "FET", "10-12"),
    "CAPS FET _ LIFE ORIENTATION _ GR 10-12 _ WEB_E6B3.pdf": ("10001424", "LO", "Life Orientation", "FET", "10-12"),
    "CAPS FET _ LIFE SCIENCES _ GR 10-12 Web_2636.pdf": ("10001034", "LFSC", "Life Sciences", "FET", "10-12"),
    "CAPS FET _ MUSIC _ GR 10-12 _ Web_84B0.pdf": ("11351154", "MUSI", "Music", "FET", "10-12"),
    "CAPS FET _ VISUAL ARTS _ GR 10-12 _ WEB_A758.pdf": ("11351184", "VSLA", "Visual Arts", "FET", "10-12"),
    "CAPS FET _ FAL _ ENGLISH GR 10-12 _ WEB_65DC.pdf": ("10001324", "ENFL", "English First Additional Language", "FET", "10-12"),
    "CAPS FET _ HOME _ ENGLISH GR 10-12 _ WEB_5478.pdf": ("10001014", "ENGL", "English Home Language", "FET", "10-12"),
    "CAPS FET _ HOME _ ISIXHOSA GR 10-12 _ Web_9E70.pdf": ("10001614", "XHOS", "isiXhosa Home Language", "FET", "10-12"),
    "CAPS FET _ FAL _ ISIXHOSA GR 10-12 _ WEB_503C.pdf": ("10001134", "XHFL", "isiXhosa First Additional Language", "FET", "10-12"),
    "CAPS FET _ ENGINEERING GRAPICHS & DESIGN _ GR 10-12 _ Web_8899.pdf": ("10001284", "EGDN", "Engineering Graphics and Design", "FET", "10-12"),
    "CAPS FET _ AGRI MANAGEMENT PRACTICES GR 10-12 _ WEB_B373.pdf": ("10351064", "AGMP", "Agricultural Management Practices", "FET", "10-12"),
    "CAPS FET _ AGRICULTURAL TECHNOLOGY _ WEB_2AF0.pdf": ("10351074", "AGRT", "Agricultural Technology", "FET", "10-12"),
    "CAPS FET _ CIVIL TECHNOLOGY _ GR 10-12 _ Web_ABB6.pdf": ("10001204", "CIVL", "Civil Technology", "FET", "10-12"),
    "CAPS FET _ DANCE STUDIES _ GR 10-12 _ Web_6466.pdf": ("11351094", "DANC", "Dance Studies", "FET", "10-12"),
    "CAPS FET _ DESIGN STUDIES _ GR 10-12 _ WEB_4977.pdf": ("11351104", "DSGN", "Design Studies", "FET", "10-12"),
    "CAPS FET _ ELECTRICAL TECHNOLOGY _ GR 10-12 _ WEB_C57C.pdf": ("10001274", "ELEC", "Electrical Technology", "FET", "10-12"),
    "CAPS FET _ MECHANICAL TECHNOLOGY _ GR 10-12 _ WEB_36E9.pdf": ("10001494", "MECH", "Mechanical Technology", "FET", "10-12"),
    "CAPS FET _ RELIGION STUDIES _ GR 10-12 _ WEB_32D7.pdf": ("10001504", "RELI", "Religion Studies", "FET", "10-12"),
    "CAPS FET _ XITSONGA FAL GR 10-12 _ WEB_1D49.PDF": ("10001204", "XTFL", "Xitsonga First Additional Language", "FET", "10-12"),
}

def identify_subject(filename):
    return SUBJECT_MAP.get(filename)

def extract_text_pages(pdf_path, start_page=1, end_page=50):
    doc = fitz.open(pdf_path)
    texts = []
    for i in range(start_page - 1, min(end_page, len(doc))):
        page = doc[i]
        texts.append(page.get_text())
    doc.close()
    return texts

def is_likely_topic(line, prev_line, next_line):
    """Better heuristic to determine if a line is a topic name"""
    line = line.strip()
    if len(line) < 3 or len(line) > 60:
        return False

    # Must be mostly letters/spaces (not numbers/symbols heavy)
    alpha_ratio = sum(1 for c in line if c.isalpha() or c.isspace()) / len(line) if len(line) > 0 else 0
    if alpha_ratio < 0.7:
        return False

    # Skip if contains too many numbers (not a topic name)
    digit_count = sum(1 for c in line if c.isdigit())
    if digit_count > 3:
        return False

    # Skip common non-topic patterns
    skip_patterns = [
        'CAPS', 'CURRICULUM', 'SECTION', 'CONTENTS', 'PAGE',
        'GRADE 10', 'GRADE 11', 'GRADE 12', 'GRADES 10-12',
        'HOURS', 'WEEKS', 'TIME', 'ALLOCATION', 'ASSESSMENT',
        'PRACTICAL', 'WEIGHTING', 'OVERVIEW', 'INTRODUCTION',
        'POLICY', 'STATEMENT', 'NATIONAL', 'SENIOR',
        'BACKGROUND', 'AIMS', 'PURPOSE', 'GENERAL',
        'TABLE', 'FIGURE', 'APPENDIX', 'NOTE',
        'TOTAL', 'SUBJECT', 'PHASE', 'FOUNDATION',
        'INTERMEDIATE', 'SENIOR', 'FET'
    ]
    line_upper = line.upper()
    for pattern in skip_patterns:
        if pattern in line_upper and len(line) < 40:
            return False

    # Should be title case or all caps (topic names)
    words = line.split()
    if len(words) < 2:
        return False

    # Check if it's a proper topic (capitalized words)
    title_case = sum(1 for w in words if w and w[0].isupper()) / len(words) if words else 0
    if title_case < 0.5:
        return False

    return True

def find_overview_section(texts):
    """Find overview section"""
    for idx, text in enumerate(texts):
        text_upper = text.upper()
        if ("OVERVIEW OF TOPICS" in text_upper) or \
           ("2.4" in text and "OVERVIEW" in text_upper and "TOPIC" in text_upper) or \
           ("CONTENT OVERVIEW" in text_upper):
            overview = [text]
            for j in range(idx + 1, min(idx + 10, len(texts))):
                next_text = texts[j].upper()
                if any(marker in next_text for marker in ["2.5", "2.6", "SECTION 3", "3.1", "WEIGHTING"]):
                    if len(overview) >= 2:
                        break
                overview.append(texts[j])
            return overview
    return []

def parse_physical_sciences(overview_text, subject_codes):
    """Physical Sciences specific parser"""
    subject_official_code, subject_alpha_code, subject_name, phase, grades = subject_codes

    topics = []
    subtopics = []

    full_text = "\n".join(overview_text)
    lines = [l.strip() for l in full_text.split('\n') if l.strip()]

    # Physical Sciences has 6 knowledge areas, each with 3 grades
    knowledge_areas = [
        "Mechanics",
        "Waves, Sound and Light", 
        "Electricity and Magnetism",
        "Matter and Materials",
        "Chemical Systems",
        "Chemical Change"
    ]

    topic_counter = 1

    for area in knowledge_areas:
        for grade in [10, 11, 12]:
            topic_code = f"{subject_alpha_code}{topic_counter:02d}"
            topics.append({
                "topic_code": topic_code,
                "subject_official_code": subject_official_code,
                "subject_alpha_code": subject_alpha_code,
                "subject_name": subject_name,
                "topic_name": f"{area} (Grade {grade})",
                "grade_number": grade,
                "strand": subject_name,
                "term": None,
                "topic_weighting": None,
                "time_weeks": None,
                "paper_no": 1 if area in ["Mechanics", "Waves, Sound and Light", "Electricity and Magnetism"] else 2,
                "description": f"{area} content for Grade {grade}",
                "is_active": 1,
                "display_order": topic_counter
            })
            topic_counter += 1

    # Add Skills for practical investigations (Grade 12 only)
    topics.append({
        "topic_code": f"{subject_alpha_code}{topic_counter:02d}",
        "subject_official_code": subject_official_code,
        "subject_alpha_code": subject_alpha_code,
        "subject_name": subject_name,
        "topic_name": "Skills for Practical Investigations (Grade 12)",
        "grade_number": 12,
        "strand": subject_name,
        "term": None,
        "topic_weighting": None,
        "time_weeks": 4,
        "paper_no": None,
        "description": "Skills for practical investigations in physics and chemistry",
        "is_active": 1,
        "display_order": topic_counter
    })

    return topics, subtopics

def parse_generic(overview_text, subject_codes):
    """Generic parser with better topic filtering"""
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

    for i, line in enumerate(lines):
        line_upper = line.upper().strip()

        # Skip headers and noise
        if len(line) < 50 and any(skip in line_upper for skip in ['CAPS', 'CURRICULUM', 'SECTION', 'CONTENTS', 'PAGE', 'GRADES 10-12']):
            continue

        # Detect grade markers
        grade_match = re.search(r'Grade\s*(10|11|12)', line, re.IGNORECASE)
        if grade_match:
            current_grade = int(grade_match.group(1))
            continue

        # Detect topic using improved heuristic
        prev_line = lines[i-1] if i > 0 else ""
        next_line = lines[i+1] if i < len(lines)-1 else ""

        if is_likely_topic(line, prev_line, next_line):
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

        # Detect subtopic descriptions
        if current_topic and len(line) > 20 and not line.isupper():
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
    _, subject_alpha_code, _, _, _ = subject_codes
    if subject_alpha_code == "PHYS":
        return parse_physical_sciences(overview_text, subject_codes)
    else:
        return parse_generic(overview_text, subject_codes)

def generate_sql(topics, subtopics, subject_codes):
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

    sql_lines.append("INSERT INTO lookup_caps_topics ")
    sql_lines.append("(subject_official_code, grade_number, strand, term, topic_code, topic_name, topic_weighting, time_weeks, paper_no, description, is_active, display_order)")
    sql_lines.append("VALUES")

    topic_values = []
    for t in topics:
        grade = t.get('grade_number') if t.get('grade_number') is not None else 'NULL'
        term = 'NULL'
        weight = t.get('topic_weighting') if t.get('topic_weighting') is not None else 'NULL'
        time_w = t.get('time_weeks') if t.get('time_weeks') is not None else 'NULL'
        paper = t.get('paper_no') if t.get('paper_no') is not None else 'NULL'
        desc = "'" + t.get('description', '').replace("'", "''") + "'"

        val = f"    ('{t['subject_official_code']}', {grade}, '{t['strand']}', {term}, '{t['topic_code']}', '{t['topic_name'].replace(chr(39), chr(39)+chr(39))}', {weight}, {time_w}, {paper}, {desc}, 1, {t.get('display_order', 0)})"
        topic_values.append(val)

    sql_lines.append(",\n".join(topic_values) + ";")
    sql_lines.append("")

    if subtopics:
        sql_lines.append("-- Subtopics (insert after topics)")
        for s in subtopics:
            sql_lines.append(f"-- {s.get('subtopic_code', 'UNKNOWN')}: {s.get('subtopic_name', '')[:60]}")

    return "\n".join(sql_lines)

def process_single_pdf(pdf_path):
    filename = os.path.basename(pdf_path)
    subject_codes = identify_subject(filename)

    if not subject_codes:
        return None

    subject_official_code, subject_alpha_code, subject_name, phase, grades = subject_codes
    print(f"  Processing: {filename} -> {subject_name} ({subject_alpha_code})")

    texts = extract_text_pages(pdf_path, 10, 40)
    overview = find_overview_section(texts)
    if not overview:
        texts = extract_text_pages(pdf_path, 1, 50)
        overview = find_overview_section(texts)
        if not overview:
            print(f"    ✗ No overview found")
            return None

    print(f"    Found overview across {len(overview)} pages")
    topics, subtopics = parse_overview(overview, subject_codes)
    print(f"    ✓ Extracted {len(topics)} topics, {len(subtopics)} subtopics")

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
        print("Usage: python batch_caps_parser_v4.py <caps_folder_path>")
        sys.exit(1)

    folder_path = sys.argv[1]
    if not os.path.exists(folder_path):
        print(f"Error: Folder not found: {folder_path}")
        sys.exit(1)

    pdf_files = [f for f in os.listdir(folder_path) 
                 if f.lower().endswith('.pdf') and os.path.isfile(os.path.join(folder_path, f))]
    pdf_files.sort()

    print(f"Found {len(pdf_files)} PDF files")
    print("=" * 70)

    results = []

    for pdf_file in pdf_files:
        pdf_path = os.path.join(folder_path, pdf_file)
        print(f"\n[{len(results)+1}/{len(pdf_files)}] {pdf_file}")

        result = process_single_pdf(pdf_path)
        if result:
            results.append(result)
            sql_filename = f"caps_v4_{result['subject_alpha_code'].lower()}.sql"
            sql_path = os.path.join(folder_path, sql_filename)
            with open(sql_path, 'w', encoding='utf-8') as f:
                f.write(result['sql'])
            print(f"    ✓ Saved SQL: {sql_filename}")

    json_path = os.path.join(folder_path, "batch_caps_results_v4.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump({"processed": results, "timestamp": datetime.now().isoformat()}, f, indent=2, default=str)

    print(f"\n{'='*70}")
    print(f"BATCH COMPLETE: {len(results)} subjects processed")
    if results:
        print(f"\n{'CODE':<6} | {'SUBJECT':<35} | {'TOPICS':<6} | {'SUBTOPICS':<9}")
        print(f"{'-'*70}")
        total_topics = 0
        total_subtopics = 0
        for r in results:
            print(f"{r['subject_alpha_code']:<6} | {r['subject']:<35} | {len(r['topics']):<6} | {len(r['subtopics']):<9}")
            total_topics += len(r['topics'])
            total_subtopics += len(r['subtopics'])
        print(f"{'-'*70}")
        print(f"TOTAL  | {'':<35} | {total_topics:<6} | {total_subtopics:<9}")
    print(f"\nResults saved to: {json_path}")

if __name__ == "__main__":
    main()
