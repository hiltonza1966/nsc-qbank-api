#!/usr/bin/env python3
"""
CAPS Batch Parser V5 - Correct Subject Codes from CSV
Processes all CAPS PDFs and extracts topics with correct official codes
"""

import fitz
import sys
import os
import re
import json
from datetime import datetime

# Filename to subject mapping (correct codes from CSV)
SUBJECT_MAP = {
    "CAPS FET PHYSICAL SCIENCE WEB.pdf": ("19351114", "PHSC", "Physical Sciences"),
    "CAPS FET _ AGRICULTURAL SCIENCE _ WEB_1CC4.pdf": ("10351054", "AGRS", "Agricultural Sciences"),
    "CAPS FET _ COMPUTER APPLICATIONS TECHNOLOGY _ GR 10-12 _ Web_6AC6.pdf": ("19351024", "CATN", "Computer Applications Technology"),
    "CAPS FET _ Consumer Studies GR 10-12 _ WEB_C5DB.pdf": ("20351024", "CNST", "Consumer Studies"),
    "CAPS FET _ DRAMATIC ARTS _ GR 10-12 _ WEB_EA5E.pdf": ("11351084", "DRMA", "Dramatic Arts"),
    "CAPS FET _ HOSPITALITY STUDIES _ GR 10-12 _ Web_2EA7.pdf": ("20351054", "HOSP", "Hospitality Studies"),
    "CAPS FET _ INFORMATION TECHNOLOGY _ GR 10-12 _ Web_E677.pdf": ("19351054", "INFT", "Information Technology"),
    "CAPS FET _ LIFE ORIENTATION _ GR 10-12 _ WEB_E6B3.pdf": ("16341024", "LIFE", "Life Orientation"),
    "CAPS FET _ LIFE SCIENCES _ GR 10-12 Web_2636.pdf": ("19351084", "LFSC", "Life Sciences"),
    "CAPS FET _ MUSIC _ GR 10-12 _ Web_84B0.pdf": ("11351114", "MUSC", "Music"),
    "CAPS FET _ VISUAL ARTS _ GR 10-12 _ WEB_A758.pdf": ("11351144", "VSLA", "Visual Arts"),
    "CAPS FET _ FAL _ ENGLISH GR 10-12 _ WEB_65DC.pdf": ("13311114", "ENGFA", "English First Additional Language"),
    "CAPS FET _ HOME _ ENGLISH GR 10-12 _ WEB_5478.pdf": ("13301084", "ENGHL", "English Home Language"),
    "CAPS FET _ HOME _ ISIXHOSA GR 10-12 _ Web_9E70.pdf": ("13301204", "XHOHL", "isiXhosa Home Language"),
    "CAPS FET _ FAL _ ISIXHOSA GR 10-12 _ WEB_503C.pdf": ("13311234", "XHOFA", "isiXhosa First Additional Language"),
    "CAPS FET _ ENGINEERING GRAPICHS & DESIGN _ GR 10-12 _ Web_8899.pdf": ("15351114", "GRDS", "Engineering Graphics and Design"),
    "CAPS FET _ AGRI MANAGEMENT PRACTICES GR 10-12 _ WEB_B373.pdf": ("10351024", "AGRM", "Agricultural Management Practices"),
    "CAPS FET _ AGRICULTURAL TECHNOLOGY _ WEB_2AF0.pdf": ("10351084", "AGRT", "Agricultural Technology"),
    "CAPS FET _ CIVIL TECHNOLOGY _ GR 10-12 _ Web_ABB6.pdf": ("15351264", "CVTC", "Civil Technology (Construction)"),
    "CAPS FET _ DANCE STUDIES _ GR 10-12 _ Web_6466.pdf": ("11351024", "DNCE", "Dance Studies"),
    "CAPS FET _ DESIGN STUDIES _ GR 10-12 _ WEB_4977.pdf": ("11351054", "DSGN", "Design"),
    "CAPS FET _ ELECTRICAL TECHNOLOGY _ GR 10-12 _ WEB_C57C.pdf": ("15351354", "ELTP", "Electrical Technology (Power Systems)"),
    "CAPS FET _ MECHANICAL TECHNOLOGY _ GR 10-12 _ WEB_36E9.pdf": ("15351444", "MCTA", "Mechanical Technology (Automotive)"),
    "CAPS FET _ RELIGION STUDIES _ GR 10-12 _ WEB_32D7.pdf": ("16351114", "RLGS", "Religion Studies"),
    "CAPS FET _ XITSONGA FAL GR 10-12 _ WEB_1D49.PDF": ("13311664", "XITFA", "Xitsonga First Additional Language"),
    "CAPS FET _ FAL _ AFRIKAANS GR 10-12 _ WEB_9455.pdf": ("13311054", "AFRFA", "Afrikaans First Additional Language"),
    "CAPS FET _ HOME _ AFRIKAANS GR 10-12 _ WEB_0544.PDF": ("13301024", "AFRHL", "Afrikaans Home Language"),
    "CAPS FET _ FAL _ ISIZULU GR 10-12 _ WEB_6CFE.pdf": ("13311294", "ZULFA", "isiZulu First Additional Language"),
    "CAPS FET _ HOME _ ISIZULU GR 10-12 _ WEB_5D5A.pdf": ("13301264", "ZULHL", "isiZulu Home Language"),
    "CAPS FET _ FAL _ SEPEDI GR 10-12 _ WEB_4737.pdf": ("13311354", "SEPFA", "Sepedi First Additional Language"),
    "CAPS FET _ HOME _ SEPEDI GR 10-12 _ WEB_9F5B.pdf": ("13301324", "SEPHL", "Sepedi Home Language"),
    "CAPS FET _ FAL _ SESOTHO GR 10-12 _ Web_02A1.pdf": ("13311414", "SESFA", "Sesotho First Additional Language"),
    "CAPS FET _ HOME _ SESOTHO GR 10-12 _ WEB_3E83.pdf": ("13301384", "SESHL", "Sesotho Home Language"),
    "CAPS FET _ FAL _ SETSWANA GR 10-12 _ Web_E693.pdf": ("13311474", "SETFA", "Setswana First Additional Language"),
    "CAPS FET _ HOME _ SETSWANA GR 10-12 _ WEB_28DF.pdf": ("13301444", "SETHL", "Setswana Home Language"),
    "CAPS FET _ FAL _ SISWATI GR 10-12 _ WEB_9726.pdf": ("13311534", "SWAFA", "SiSwati First Additional Language"),
    "CAPS FET _ HOME _ SISWATI GR 10-12 _ WEB_A682.pdf": ("13301504", "SWAHL", "SiSwati Home Language"),
    "CAPS FET _ FAL _ THSIVENDA GR 10-12 _ WEB_BD00.PDF": ("13311604", "TSVFA", "Tshivenda First Additional Language"),
    "CAPS FET _ HOME _ TSHIVENDA GR 10-12 _ WEB_8F73.PDF": ("13301574", "TSVHL", "Tshivenda Home Language"),
    "CAPS FET _ HOME _ XITSONGA GR 10-12 _ WEB_890B.pdf": ("13301634", "XITHL", "Xitsonga Home Language"),
    "CAPS FET _ FAL _ isiNdebele GR 10-12 _ WEB _5A30.pdf": ("13311174", "NDBFA", "IsiNdebele First Additional Language"),
    "CAPS FET _ HOME _ isiNdebele GR10-12 _ WEB_D8ED.pdf": ("13301144", "NDBHL", "IsiNdebele Home Language"),
    "CAPS FET _ ACCOUNTING GR 10-12 _ Web_CAB3.pdf": ("12351024", "ACCN", "Accounting"),
    "CAPS FET _ BUSINESS STUDIES _ GR 10-12 _ Web_0CA7.pdf": ("12351054", "BSTD", "Business Studies"),
    "CAPS FET _ ECONOMICS _ GR 10-12 _ WEB_BD13.pdf": ("12351084", "ECON", "Economics"),
    "CAPS FET _ GEOGRAPHY _ GR 10-12 _ WEB_C9A9.pdf": ("16351054", "GEOG", "Geography"),
    "CAPS FET _ MATHEMATICAL LITERACY _ GR 10-12 _ Web_DDA9.pdf": ("19321024", "MLIT", "Mathematical Literacy"),
    "CAPS FET _ MATHEMATICS _ GR 10-12 _ Web_1133.pdf": ("19331054", "MATH", "Mathematics"),
    "CAPS FET _ TOURISM _ GR 10-12 Web_1FAC.pdf": ("20351084", "TRSM", "Tourism"),
    "CAPS Maths Tech Final Bleed and crops.pdf": ("19371504", "TMAT", "Technical Mathematics"),
    "CAPS Science Tech bleed and crops.pdf": ("19351534", "TSCE", "Technical Sciences"),
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

def find_overview_section(texts):
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

def is_likely_topic(line, prev_line, next_line):
    line = line.strip()
    if len(line) < 3 or len(line) > 60:
        return False
    alpha_ratio = sum(1 for c in line if c.isalpha() or c.isspace()) / len(line) if len(line) > 0 else 0
    if alpha_ratio < 0.7:
        return False
    digit_count = sum(1 for c in line if c.isdigit())
    if digit_count > 3:
        return False
    skip_patterns = ['CAPS', 'CURRICULUM', 'SECTION', 'CONTENTS', 'PAGE', 'GRADE 10', 'GRADE 11', 'GRADE 12', 'GRADES 10-12', 'HOURS', 'WEEKS', 'TIME', 'ALLOCATION', 'ASSESSMENT', 'PRACTICAL', 'WEIGHTING', 'OVERVIEW', 'INTRODUCTION', 'POLICY', 'STATEMENT', 'NATIONAL', 'SENIOR', 'BACKGROUND', 'AIMS', 'PURPOSE', 'GENERAL', 'TABLE', 'FIGURE', 'APPENDIX', 'NOTE', 'TOTAL', 'SUBJECT', 'PHASE', 'FOUNDATION', 'INTERMEDIATE', 'SENIOR', 'FET']
    line_upper = line.upper()
    for pattern in skip_patterns:
        if pattern in line_upper and len(line) < 40:
            return False
    words = line.split()
    if len(words) < 2:
        return False
    title_case = sum(1 for w in words if w and w[0].isupper()) / len(words) if words else 0
    if title_case < 0.5:
        return False
    return True

def parse_physical_sciences(overview_text, subject_codes):
    subject_official_code, subject_alpha_code, subject_name = subject_codes
    topics = []
    knowledge_areas = ["Mechanics", "Waves, Sound and Light", "Electricity and Magnetism", "Matter and Materials", "Chemical Systems", "Chemical Change"]
    topic_counter = 1
    for area in knowledge_areas:
        for grade in [10, 11, 12]:
            topic_code = f"{subject_alpha_code}{topic_counter:02d}"
            topics.append({
                "topic_code": topic_code,
                "subject_official_code": subject_official_code,
                "subject_alpha_code": subject_alpha_code,
                "topic_name": f"{area} (Grade {grade})",
                "grade_number": grade,
                "strand": subject_name,
                "paper_no": 1 if area in ["Mechanics", "Waves, Sound and Light", "Electricity and Magnetism"] else 2,
                "description": f"{area} content for Grade {grade}",
                "display_order": topic_counter
            })
            topic_counter += 1
    topics.append({
        "topic_code": f"{subject_alpha_code}{topic_counter:02d}",
        "subject_official_code": subject_official_code,
        "subject_alpha_code": subject_alpha_code,
        "topic_name": "Skills for Practical Investigations (Grade 12)",
        "grade_number": 12,
        "strand": subject_name,
        "paper_no": None,
        "description": "Skills for practical investigations in physics and chemistry",
        "display_order": topic_counter
    })
    return topics

def parse_generic(overview_text, subject_codes):
    subject_official_code, subject_alpha_code, subject_name = subject_codes
    topics = []
    full_text = "\n".join(overview_text)
    lines = [l.strip() for l in full_text.split('\n') if l.strip()]
    current_grade = None
    topic_counter = 1
    for line in lines:
        line_upper = line.upper().strip()
        if len(line) < 50 and any(skip in line_upper for skip in ['CAPS', 'CURRICULUM', 'SECTION', 'CONTENTS', 'PAGE', 'GRADES 10-12']):
            continue
        grade_match = re.search(r'Grade\s*(10|11|12)', line, re.IGNORECASE)
        if grade_match:
            current_grade = int(grade_match.group(1))
            continue
        if is_likely_topic(line, "", ""):
            topic_code = f"{subject_alpha_code}{topic_counter:02d}"
            topics.append({
                "topic_code": topic_code,
                "subject_official_code": subject_official_code,
                "subject_alpha_code": subject_alpha_code,
                "topic_name": line.strip(),
                "grade_number": current_grade,
                "strand": subject_name,
                "paper_no": None,
                "description": "",
                "display_order": topic_counter
            })
            topic_counter += 1
    return topics

def parse_overview(overview_text, subject_codes):
    _, subject_alpha_code, _ = subject_codes
    if subject_alpha_code == "PHSC":
        return parse_physical_sciences(overview_text, subject_codes)
    else:
        return parse_generic(overview_text, subject_codes)

def generate_sql(topics, subject_codes):
    subject_official_code, subject_alpha_code, subject_name = subject_codes
    sql_lines = []
    sql_lines.append(f"-- CAPS Topics for {subject_name} ({subject_alpha_code})")
    sql_lines.append(f"-- Generated: {datetime.now().isoformat()}")
    sql_lines.append("")
    sql_lines.append("USE nsc_qbank;")
    sql_lines.append("")
    if not topics:
        sql_lines.append("-- NO TOPICS FOUND")
        return "\n".join(sql_lines)
    sql_lines.append("INSERT INTO lookup_caps_topics (subject_official_code, grade_number, strand, topic_code, topic_name, paper_no, description, is_active, display_order) VALUES")
    topic_values = []
    for t in topics:
        grade = t.get('grade_number') if t.get('grade_number') is not None else 'NULL'
        paper = t.get('paper_no') if t.get('paper_no') is not None else 'NULL'
        desc = t.get('description', '').replace("'", "''")
        val = f"    ('{t['subject_official_code']}', {grade}, '{t['strand']}', '{t['topic_code']}', '{t['topic_name'].replace(chr(39), chr(39)+chr(39))}', {paper}, '{desc}', 1, {t.get('display_order', 0)})"
        topic_values.append(val)
    sql_lines.append(",\n".join(topic_values) + ";")
    return "\n".join(sql_lines)

def process_single_pdf(pdf_path):
    filename = os.path.basename(pdf_path)
    subject_codes = identify_subject(filename)
    if not subject_codes:
        print(f"  SKIP: Not in SUBJECT_MAP: {filename}")
        return None
    subject_official_code, subject_alpha_code, subject_name = subject_codes
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
    topics = parse_overview(overview, subject_codes)
    print(f"    ✓ Extracted {len(topics)} topics")
    sql = generate_sql(topics, subject_codes)
    return {
        "subject": subject_name,
        "subject_alpha_code": subject_alpha_code,
        "subject_official_code": subject_official_code,
        "topics": topics,
        "sql": sql,
        "overview_pages": len(overview)
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: python batch_caps_parser_v5.py <caps_folder_path>")
        sys.exit(1)
    folder_path = sys.argv[1]
    if not os.path.exists(folder_path):
        print(f"Error: Folder not found: {folder_path}")
        sys.exit(1)
    pdf_files = [f for f in os.listdir(folder_path) if f.lower().endswith('.pdf') and os.path.isfile(os.path.join(folder_path, f))]
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
            sql_filename = f"caps_v5_{result['subject_alpha_code'].lower()}.sql"
            sql_path = os.path.join(folder_path, sql_filename)
            with open(sql_path, 'w', encoding='utf-8') as f:
                f.write(result['sql'])
            print(f"    ✓ Saved SQL: {sql_filename}")
    json_path = os.path.join(folder_path, "batch_caps_results_v5.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump({"processed": results, "timestamp": datetime.now().isoformat()}, f, indent=2, default=str)
    print(f"\n{'='*70}")
    print(f"BATCH COMPLETE: {len(results)}/{len(pdf_files)} subjects processed")
    if results:
        print(f"\n{'CODE':<8} | {'SUBJECT':<40} | {'TOPICS':<6}")
        print(f"{'-'*70}")
        total_topics = 0
        for r in results:
            print(f"{r['subject_alpha_code']:<8} | {r['subject']:<40} | {len(r['topics']):<6}")
            total_topics += len(r['topics'])
        print(f"{'-'*70}")
        print(f"TOTAL    | {'':<40} | {total_topics:<6}")
    print(f"\nResults saved to: {json_path}")

if __name__ == "__main__":
    main()
