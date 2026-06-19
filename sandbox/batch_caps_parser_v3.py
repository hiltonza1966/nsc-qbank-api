#!/usr/bin/env python3
"""
Comprehensive CAPS Batch Parser V3 - Exact Filename Mapping
Processes all CAPS PDFs with exact filename matching
"""

import fitz
import sys
import os
import re
import json
from datetime import datetime

# EXACT filename mapping based on actual files in folder
SUBJECT_MAP = {
    # Core subjects (already have topics - skip these)
    "CAPS FET _ ACCOUNTING GR 10-12 _ Web_CAB3.pdf": ("10001024", "ACCN", "Accounting", "FET", "10-12", True),
    "CAPS FET _ BUSINESS STUDIES _ GR 10-12 _ Web_0CA7.pdf": ("10001164", "BUSN", "Business Studies", "FET", "10-12", True),
    "CAPS FET _ ECONOMICS _ GR 10-12 _ WEB_BD13.pdf": ("10001264", "ECON", "Economics", "FET", "10-12", True),
    "CAPS FET _ GEOGRAPHY _ GR 10-12 _ WEB_C9A9.pdf": ("10001354", "GEOG", "Geography", "FET", "10-12", True),
    # History not in folder? Skip if not present
    "CAPS FET _ MATHEMATICAL LITERACY _ GR 10-12 _ Web_DDA9.pdf": ("10001474", "MLIT", "Mathematical Literacy", "FET", "10-12", True),
    "CAPS FET _ MATHEMATICS _ GR 10-12 _ Web_1133.pdf": ("10001044", "MATH", "Mathematics", "FET", "10-12", True),
    "CAPS FET _ TOURISM _ GR 10-12 Web_1FAC.pdf": ("10001584", "TOUR", "Tourism", "FET", "10-12", True),

    # Technical subjects (already have topics)
    "CAPS Maths Tech Final Bleed and crops.pdf": ("10001634", "TMAT", "Technical Mathematics", "FET", "10-12", True),
    "CAPS Science Tech bleed and crops.pdf": ("10001654", "TECH", "Technical Sciences", "FET", "10-12", True),

    # Subjects needing topics (19 subjects)
    "CAPS FET PHYSICAL SCIENCE WEB.pdf": ("10001064", "PHYS", "Physical Sciences", "FET", "10-12", False),
    "CAPS FET _ AGRICULTURAL SCIENCE _ WEB_1CC4.pdf": ("10351054", "AGRI", "Agricultural Sciences", "FET", "10-12", False),
    "CAPS FET _ COMPUTER APPLICATIONS TECHNOLOGY _ GR 10-12 _ Web_6AC6.pdf": ("10001204", "CATN", "Computer Applications Technology", "FET", "10-12", False),
    "CAPS FET _ Consumer Studies GR 10-12 _ WEB_C5DB.pdf": ("10001234", "CONS", "Consumer Studies", "FET", "10-12", False),
    "CAPS FET _ DRAMATIC ARTS _ GR 10-12 _ WEB_EA5E.pdf": ("11351084", "DRAM", "Dramatic Arts", "FET", "10-12", False),
    "CAPS FET _ HOSPITALITY STUDIES _ GR 10-12 _ Web_2EA7.pdf": ("11351124", "HTEL", "Hospitality Studies", "FET", "10-12", False),
    "CAPS FET _ INFORMATION TECHNOLOGY _ GR 10-12 _ Web_E677.pdf": ("10001404", "INFT", "Information Technology", "FET", "10-12", False),
    "CAPS FET _ LIFE ORIENTATION _ GR 10-12 _ WEB_E6B3.pdf": ("10001424", "LO", "Life Orientation", "FET", "10-12", False),
    "CAPS FET _ LIFE SCIENCES _ GR 10-12 Web_2636.pdf": ("10001034", "LFSC", "Life Sciences", "FET", "10-12", False),
    "CAPS FET _ MUSIC _ GR 10-12 _ Web_84B0.pdf": ("11351154", "MUSI", "Music", "FET", "10-12", False),
    "CAPS FET _ VISUAL ARTS _ GR 10-12 _ WEB_A758.pdf": ("11351184", "VSLA", "Visual Arts", "FET", "10-12", False),

    # Languages - FAL
    "CAPS FET _ FAL _ AFRIKAANS GR 10-12 _ WEB_9455.pdf": ("10001114", "AFAL", "Afrikaans First Additional Language", "FET", "10-12", False),
    "CAPS FET _ FAL _ ENGLISH GR 10-12 _ WEB_65DC.pdf": ("10001324", "ENFL", "English First Additional Language", "FET", "10-12", False),
    "CAPS FET _ FAL _ ISIXHOSA GR 10-12 _ WEB_503C.pdf": ("10001134", "XHFL", "isiXhosa First Additional Language", "FET", "10-12", False),
    "CAPS FET _ FAL _ ISIZULU GR 10-12 _ WEB_6CFE.pdf": ("10001144", "ZUFL", "isiZulu First Additional Language", "FET", "10-12", False),
    "CAPS FET _ FAL _ SEPEDI GR 10-12 _ WEB_4737.pdf": ("10001154", "SEFL", "Sepedi First Additional Language", "FET", "10-12", False),

    # Languages - Home
    "CAPS FET _ HOME _ AFRIKAANS GR 10-12 _ WEB_0544.PDF": ("10001094", "AFHL", "Afrikaans Home Language", "FET", "10-12", False),
    "CAPS FET _ HOME _ ENGLISH GR 10-12 _ WEB_5478.pdf": ("10001014", "ENGL", "English Home Language", "FET", "10-12", False),
    "CAPS FET _ HOME _ ISIXHOSA GR 10-12 _ Web_9E70.pdf": ("10001614", "XHOS", "isiXhosa Home Language", "FET", "10-12", False),
    "CAPS FET _ HOME _ ISIZULU GR 10-12 _ WEB_5D5A.pdf": ("10001594", "ZULU", "isiZulu Home Language", "FET", "10-12", False),
    "CAPS FET _ HOME _ SEPEDI GR 10-12 _ WEB_9F5B.pdf": ("10001524", "SETH", "Sepedi Home Language", "FET", "10-12", False),

    # Engineering/Design
    "CAPS FET _ ENGINEERING GRAPICHS & DESIGN _ GR 10-12 _ Web_8899.pdf": ("10001284", "EGDN", "Engineering Graphics and Design", "FET", "10-12", False),

    # Additional subjects (not in the 19 but present)
    "CAPS FET _ AGRI MANAGEMENT PRACTICES GR 10-12 _ WEB_B373.pdf": ("10351064", "AGMP", "Agricultural Management Practices", "FET", "10-12", False),
    "CAPS FET _ AGRICULTURAL TECHNOLOGY _ WEB_2AF0.pdf": ("10351074", "AGRT", "Agricultural Technology", "FET", "10-12", False),
    "CAPS FET _ CIVIL TECHNOLOGY _ GR 10-12 _ Web_ABB6.pdf": ("10001204", "CIVL", "Civil Technology", "FET", "10-12", False),
    "CAPS FET _ DANCE STUDIES _ GR 10-12 _ Web_6466.pdf": ("11351094", "DANC", "Dance Studies", "FET", "10-12", False),
    "CAPS FET _ DESIGN STUDIES _ GR 10-12 _ WEB_4977.pdf": ("11351104", "DSGN", "Design Studies", "FET", "10-12", False),
    "CAPS FET _ ELECTRICAL TECHNOLOGY _ GR 10-12 _ WEB_C57C.pdf": ("10001274", "ELEC", "Electrical Technology", "FET", "10-12", False),
    "CAPS FET _ MECHANICAL TECHNOLOGY _ GR 10-12 _ WEB_36E9.pdf": ("10001494", "MECH", "Mechanical Technology", "FET", "10-12", False),
    "CAPS FET _ RELIGION STUDIES _ GR 10-12 _ WEB_32D7.pdf": ("10001504", "RELI", "Religion Studies", "FET", "10-12", False),
    "CAPS FET _ XITSONGA FAL GR 10-12 _ WEB_1D49.PDF": ("10001204", "XTFL", "Xitsonga First Additional Language", "FET", "10-12", False),

    # More languages
    "CAPS FET _ FAL _ SESOTHO GR 10-12 _ Web_02A1.pdf": ("10001164", "SOFL", "Sesotho First Additional Language", "FET", "10-12", False),
    "CAPS FET _ FAL _ SETSWANA GR 10-12 _ Web_E693.pdf": ("10001174", "TSFL", "Setswana First Additional Language", "FET", "10-12", False),
    "CAPS FET _ FAL _ SISWATI GR 10-12 _ WEB_9726.pdf": ("10001184", "SWFL", "siSwati First Additional Language", "FET", "10-12", False),
    "CAPS FET _ FAL _ THSIVENDA GR 10-12 _ WEB_BD00.PDF": ("10001194", "TVFL", "Tshivenda First Additional Language", "FET", "10-12", False),
    "CAPS FET _ FAL _ isiNdebele GR 10-12 _ WEB _5A30.pdf": ("10001214", "NDFL", "isiNdebele First Additional Language", "FET", "10-12", False),
    "CAPS FET _ HOME _ SESOTHO GR 10-12 _ WEB_3E83.pdf": ("10001624", "SOTHO", "Sesotho Home Language", "FET", "10-12", False),
    "CAPS FET _ HOME _ SETSWANA GR 10-12 _ WEB_28DF.pdf": ("10001634", "TSWA", "Setswana Home Language", "FET", "10-12", False),
    "CAPS FET _ HOME _ SISWATI GR 10-12 _ WEB_A682.pdf": ("10001644", "SWAT", "siSwati Home Language", "FET", "10-12", False),
    "CAPS FET _ HOME _ TSHIVENDA GR 10-12 _ WEB_8F73.PDF": ("10001654", "TSHI", "Tshivenda Home Language", "FET", "10-12", False),
    "CAPS FET _ HOME _ XITSONGA GR 10-12 _ WEB_890B.pdf": ("10001664", "XITS", "Xitsonga Home Language", "FET", "10-12", False),
    "CAPS FET _ HOME _ isiNdebele GR10-12 _ WEB_D8ED.pdf": ("10001674", "NDEB", "isiNdebele Home Language", "FET", "10-12", False),
}

def identify_subject(filename):
    """Exact filename matching"""
    return SUBJECT_MAP.get(filename)

def extract_text_pages(pdf_path, start_page=1, end_page=50):
    """Extract text from page range"""
    doc = fitz.open(pdf_path)
    texts = []
    for i in range(start_page - 1, min(end_page, len(doc))):
        page = doc[i]
        texts.append(page.get_text())
    doc.close()
    return texts

def find_overview_section(texts, max_pages=30):
    """Find the overview section with multiple strategies"""
    # Strategy 1: Look for "OVERVIEW OF TOPICS" or "2.4"
    for idx, text in enumerate(texts):
        text_upper = text.upper()
        if ("OVERVIEW OF TOPICS" in text_upper) or \
           ("2.4" in text and "OVERVIEW" in text_upper and "TOPIC" in text_upper) or \
           ("CONTENT OVERVIEW" in text_upper) or \
           ("TOPIC OVERVIEW" in text_upper):
            # Collect pages until next major section
            overview = [text]
            for j in range(idx + 1, min(idx + 10, len(texts))):
                next_text = texts[j].upper()
                if any(marker in next_text for marker in [
                    "2.5", "2.6", "SECTION 3", "3.1", "GRADE 10", "TERM 1",
                    "WEIGHTING OF TOPICS", "OVERVIEW OF PRACTICAL WORK"
                ]):
                    if len(overview) >= 2:
                        break
                overview.append(texts[j])
            return overview

    # Strategy 2: Look for tables with "Grade 10", "Grade 11", "Grade 12"
    for idx, text in enumerate(texts):
        if "Grade 10" in text and "Grade 11" in text and "Grade 12" in text:
            overview = [text]
            for j in range(idx + 1, min(idx + 8, len(texts))):
                overview.append(texts[j])
            return overview

    # Strategy 3: Look for "SECTION 2" followed by topic-like content
    for idx, text in enumerate(texts):
        if "SECTION 2" in text.upper() or "2.1" in text:
            # Scan ahead for topic tables
            for j in range(idx, min(idx + 15, len(texts))):
                if any(marker in texts[j] for marker in ["Topic", "Content", "Grade 10"]):
                    overview = []
                    for k in range(j, min(j + 10, len(texts))):
                        overview.append(texts[k])
                    return overview

    return []

def parse_physical_sciences_overview(overview_text, subject_codes):
    """Parse Physical Sciences specific overview format"""
    subject_official_code, subject_alpha_code, subject_name, phase, grades, has_topics = subject_codes

    topics = []
    subtopics = []

    full_text = "\n".join(overview_text)
    lines = [l.strip() for l in full_text.split('\n') if l.strip()]

    # Physical Sciences has 6 main knowledge areas
    knowledge_areas = {
        "MECHANICS": [],
        "WAVES, SOUND AND LIGHT": [],
        "WAVES, SOUND & LIGHT": [],
        "ELECTRICITY AND MAGNETISM": [],
        "ELECTRICITY & MAGNETISM": [],
        "MATTER AND MATERIALS": [],
        "MATTER & MATERIALS": [],
        "CHEMICAL SYSTEMS": [],
        "CHEMICAL CHANGE": [],
        "SKILLS FOR PRACTICAL INVESTIGATIONS": []
    }

    current_topic = None
    current_topic_code = None
    topic_counter = 1
    subtopic_counter = 1
    current_grade = None

    for i, line in enumerate(lines):
        line_upper = line.upper().strip()

        # Detect main knowledge areas
        for area in knowledge_areas.keys():
            if area in line_upper and len(line) < 60:
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
        if grade_match and current_topic:
            current_grade = int(grade_match.group(1))
            # Update last topic with grade
            if topics and topics[-1]["grade_number"] is None:
                topics[-1]["grade_number"] = current_grade
            elif topics:
                # Create new topic for this grade
                new_topic = topics[-1].copy()
                new_topic["topic_code"] = f"{subject_alpha_code}{topic_counter-1:02d}G{current_grade}"
                new_topic["grade_number"] = current_grade
                new_topic["display_order"] = topic_counter
                topics.append(new_topic)
                topic_counter += 1

        # Detect content descriptions (subtopics)
        if current_topic and len(line) > 20 and not line.isupper():
            content_markers = ['reference', 'displacement', 'energy', 'force', 'wave', 'atom', 'molecule', 
                              'vector', 'scalar', 'motion', 'electric', 'magnetic', 'chemical', 'reaction']
            if any(m in line.lower() for m in content_markers):
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

def parse_generic_overview(overview_text, subject_codes):
    """Generic parser for other subjects"""
    subject_official_code, subject_alpha_code, subject_name, phase, grades, has_topics = subject_codes

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
        line_upper = line.upper().strip()

        # Skip headers
        if len(line) < 50 and any(skip in line_upper for skip in ['CAPS', 'CURRICULUM', 'SECTION', 'CONTENTS', 'PAGE', 'GRADES 10-12']):
            continue

        # Detect grade markers
        grade_match = re.search(r'Grade\s*(10|11|12)', line, re.IGNORECASE)
        if grade_match:
            current_grade = int(grade_match.group(1))
            continue

        # Detect topic names (standalone, capitalized, reasonable length)
        if re.match(r'^[A-Z][A-Za-z\s,&/-]+$', line) and 5 < len(line) < 60:
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
    """Route to appropriate parser"""
    _, subject_alpha_code, _, _, _, _ = subject_codes

    if subject_alpha_code == "PHYS":
        return parse_physical_sciences_overview(overview_text, subject_codes)
    else:
        return parse_generic_overview(overview_text, subject_codes)

def generate_sql(topics, subtopics, subject_codes):
    """Generate SQL INSERT statements"""
    subject_official_code, subject_alpha_code, subject_name, phase, grades, has_topics = subject_codes

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
        grade = t['grade_number'] if t['grade_number'] is not None else 'NULL'
        term = f"'{t['term']}'" if t['term'] else 'NULL'
        weight = t['topic_weighting'] if t['topic_weighting'] else 'NULL'
        time_w = t['time_weeks'] if t['time_weeks'] else 'NULL'
        paper = t['paper_no'] if t['paper_no'] else 'NULL'
        desc = t['description'].replace("'", "''") if t['description'] else ''

        val = f"    ('{t['subject_official_code']}', {grade}, '{t['strand']}', {term}, '{t['topic_code']}', '{t['topic_name'].replace(chr(39), chr(39)+chr(39))}', {weight}, {time_w}, {paper}, '{desc}', 1, {t['display_order']})"
        topic_values.append(val)

    sql_lines.append(",\n".join(topic_values) + ";")
    sql_lines.append("")

    # Subtopics
    if subtopics:
        sql_lines.append("-- Subtopics (insert after topics to get topic_id)")
        for s in subtopics:
            sql_lines.append(f"-- {s['subtopic_code']}: {s['subtopic_name'][:60]} (Topic: {s['topic_code']})")

    return "\n".join(sql_lines)

def process_single_pdf(pdf_path):
    """Process a single CAPS PDF"""
    filename = os.path.basename(pdf_path)
    subject_codes = identify_subject(filename)

    if not subject_codes:
        print(f"  ⚠ SKIP: Not in SUBJECT_MAP: {filename}")
        return None

    subject_official_code, subject_alpha_code, subject_name, phase, grades, has_topics = subject_codes

    if has_topics:
        print(f"  SKIP (already has topics): {filename} -> {subject_name}")
        return {"skipped": True, "reason": "already_has_topics", "subject": subject_name, "subject_alpha_code": subject_alpha_code}

    print(f"  Processing: {filename} -> {subject_name} ({subject_alpha_code})")

    # Extract text from pages 10-40
    texts = extract_text_pages(pdf_path, 10, 40)

    # Find overview section
    overview = find_overview_section(texts)
    if not overview:
        print(f"    ⚠ No overview found, trying pages 1-50...")
        texts = extract_text_pages(pdf_path, 1, 50)
        overview = find_overview_section(texts)
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
        print("Usage: python batch_caps_parser_v3.py <caps_folder_path>")
        sys.exit(1)

    folder_path = sys.argv[1]

    if not os.path.exists(folder_path):
        print(f"Error: Folder not found: {folder_path}")
        sys.exit(1)

    # Find all PDFs in main folder only
    pdf_files = [f for f in os.listdir(folder_path) 
                 if f.lower().endswith('.pdf') and os.path.isfile(os.path.join(folder_path, f))]
    pdf_files.sort()

    print(f"Found {len(pdf_files)} PDF files in {folder_path}")
    print("=" * 70)

    results = []
    skipped = []
    already_has = []

    for pdf_file in pdf_files:
        pdf_path = os.path.join(folder_path, pdf_file)
        print(f"\n[{len(results)+len(skipped)+len(already_has)+1}/{len(pdf_files)}] {pdf_file}")

        result = process_single_pdf(pdf_path)
        if result:
            if result.get("skipped"):
                already_has.append(result)
            else:
                results.append(result)
                sql_filename = f"caps_import_{result['subject_alpha_code'].lower()}.sql"
                sql_path = os.path.join(folder_path, sql_filename)
                with open(sql_path, 'w', encoding='utf-8') as f:
                    f.write(result['sql'])
                print(f"    ✓ Saved SQL: {sql_filename}")
        else:
            skipped.append(pdf_file)

    # Save JSON
    json_path = os.path.join(folder_path, "batch_caps_results_v3.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump({
            "processed": results,
            "skipped_files": skipped,
            "already_has_topics": already_has,
            "timestamp": datetime.now().isoformat()
        }, f, indent=2, default=str)

    print(f"\n{'='*70}")
    print(f"BATCH COMPLETE")
    print(f"{'='*70}")
    print(f"Processed (need topics): {len(results)}/{len(pdf_files)}")
    print(f"Already has topics: {len(already_has)}")
    print(f"Skipped/unmapped: {len(skipped)}")

    if results:
        print(f"\n{'='*70}")
        print(f"{'CODE':<6} | {'SUBJECT':<35} | {'TOPICS':<6} | {'SUBTOPICS':<9}")
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
