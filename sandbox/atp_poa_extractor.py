#!/usr/bin/env python3
"""
ATP/POA Extractor for CAPS Documents
Extracts:
- ATP (Annual Teaching Plan) from Section 3
- POA (Programme of Assessment) from Section 4

Usage: python atp_poa_extractor.py <caps_folder_path>
"""

import fitz
import sys
import os
import re
import json
from datetime import datetime

# Subject mapping (same as v6)
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

def extract_text_pages(pdf_path, start_page=1, end_page=100):
    doc = fitz.open(pdf_path)
    texts = []
    for i in range(start_page - 1, min(end_page, len(doc))):
        page = doc[i]
        texts.append(page.get_text())
    doc.close()
    return texts

def find_section_3_atp(texts):
    """Find Section 3: Annual Teaching Plan content"""
    atp_pages = []
    in_section = False
    for idx, text in enumerate(texts):
        text_upper = text.upper()
        if ("SECTION 3" in text_upper and ("CONTENT" in text_upper or "TEACHING" in text_upper)) or \
           ("GRADE 10" in text_upper and "TERM 1" in text_upper) or \
           ("ANNUAL TEACHING PLAN" in text_upper):
            in_section = True
            atp_pages.append(text)
            continue
        if in_section:
            if any(marker in text_upper for marker in ["SECTION 4", "4.1", "PROGRAMME OF ASSESSMENT", "ASSESSMENT TASKS"]):
                if len(atp_pages) >= 3:
                    break
            atp_pages.append(text)
            if len(atp_pages) > 20:
                break
    return atp_pages

def find_section_4_poa(texts):
    """Find Section 4: Programme of Assessment content"""
    poa_pages = []
    in_section = False
    for idx, text in enumerate(texts):
        text_upper = text.upper()
        if ("SECTION 4" in text_upper and ("ASSESSMENT" in text_upper or "PROGRAMME" in text_upper)) or \
           ("PROGRAMME OF ASSESSMENT" in text_upper) or \
           ("4.1" in text and "INTRODUCTION" in text_upper):
            in_section = True
            poa_pages.append(text)
            continue
        if in_section:
            if any(marker in text_upper for marker in ["SECTION 5", "5.1", "APPENDIX", "GLOSSARY"]):
                if len(poa_pages) >= 2:
                    break
            poa_pages.append(text)
            if len(poa_pages) > 10:
                break
    return poa_pages

def parse_atp_content(atp_text, subject_codes):
    """Parse ATP content into structured data"""
    subject_official_code, subject_alpha_code, subject_name = subject_codes
    atp_records = []

    full_text = "\n".join(atp_text)
    lines = [l.strip() for l in full_text.split('\n') if l.strip()]

    current_grade = None
    current_term = None
    current_week = None

    for line in lines:
        line_upper = line.upper()

        # Detect grade
        grade_match = re.search(r'Grade\s*(10|11|12)', line, re.IGNORECASE)
        if grade_match:
            current_grade = int(grade_match.group(1))
            continue

        # Detect term
        term_match = re.search(r'Term\s*(1|2|3|4)', line, re.IGNORECASE)
        if term_match:
            current_term = int(term_match.group(1))
            continue

        # Detect week range
        week_match = re.search(r'Week\s*(\d+)(?:\s*-\s*(\d+))?', line, re.IGNORECASE)
        if week_match:
            start_week = week_match.group(1)
            end_week = week_match.group(2) if week_match.group(2) else start_week
            current_week = f"{start_week}-{end_week}"
            continue

        # Detect topic/content lines (longer lines with content)
        if current_grade and current_term and len(line) > 15 and not line.isupper():
            # Check if this looks like content
            has_content = any(marker in line.lower() for marker in [';', ',', '(', ')', 'and', 'the', 'of'])
            if has_content and not re.match(r'^(Grade|Term|Week|Section|\d+\.\d+)', line, re.IGNORECASE):
                atp_records.append({
                    "subject_official_code": subject_official_code,
                    "subject_alpha_code": subject_alpha_code,
                    "subject_name": subject_name,
                    "grade": current_grade,
                    "term": current_term,
                    "week_range": current_week if current_week else f"Term {current_term}",
                    "topic": line[:100],
                    "subtopic": line,
                    "paper_no": 1,
                    "paper_code": f"{subject_alpha_code}-P1",
                    "caps_ref": "",
                    "source_url": ""
                })

    return atp_records

def parse_poa_content(poa_text, subject_codes):
    """Parse POA content into structured data"""
    subject_official_code, subject_alpha_code, subject_name = subject_codes
    poa_records = []

    full_text = "\n".join(poa_text)
    lines = [l.strip() for l in full_text.split('\n') if l.strip()]

    for line in lines:
        line_upper = line.upper()

        # Look for assessment types
        assessment_types = ['TEST', 'EXAM', 'ASSIGNMENT', 'PROJECT', 'PRACTICAL', 'PAT', 'SBA']
        if any(at in line_upper for at in assessment_types):
            # Try to extract weight and cognitive level
            weight_match = re.search(r'(\d+)%?', line)
            weight = float(weight_match.group(1)) if weight_match else None

            cognitive = None
            if 'LOWER' in line_upper or 'LEVEL 1' in line_upper or 'KNOWLEDGE' in line_upper:
                cognitive = 'Lower'
            elif 'MIDDLE' in line_upper or 'LEVEL 2' in line_upper or 'APPLICATION' in line_upper:
                cognitive = 'Middle'
            elif 'HIGHER' in line_upper or 'LEVEL 3' in line_upper or 'ANALYSIS' in line_upper:
                cognitive = 'Higher'

            poa_records.append({
                "subject_official_code": subject_official_code,
                "subject_alpha_code": subject_alpha_code,
                "subject_name": subject_name,
                "grade": 10,  # Default, should be detected per grade
                "term": None,
                "week_range": "",
                "paper_no": 1,
                "paper_code": f"{subject_alpha_code}-P1",
                "programme_of_assessment": line[:50],
                "weight_sba_pct": weight,
                "cognitive_level": cognitive,
                "caps_ref": "",
                "source_url": ""
            })

    return poa_records

def generate_atp_sql(atp_records, subject_codes):
    """Generate SQL for ATP content"""
    subject_official_code, subject_alpha_code, subject_name = subject_codes

    sql_lines = []
    sql_lines.append(f"-- ATP Content for {subject_name} ({subject_alpha_code})")
    sql_lines.append("USE nsc_qbank;")
    sql_lines.append("")

    if not atp_records:
        sql_lines.append("-- NO ATP CONTENT FOUND")
        return "\n".join(sql_lines)

    sql_lines.append("INSERT INTO caps_atp_content (subject_official_code, subject_alpha_code, subject_name, grade, term, week_range, paper_no, paper_code, topic, subtopic, caps_ref, source_url) VALUES")

    values = []
    for r in atp_records:
        term = r.get('term') if r.get('term') else 'NULL'
        val = f"    ('{r['subject_official_code']}', '{r['subject_alpha_code']}', '{r['subject_name'].replace(chr(39), chr(39)+chr(39))}', {r['grade']}, {term}, '{r['week_range']}', {r['paper_no']}, '{r['paper_code']}', '{r['topic'].replace(chr(39), chr(39)+chr(39))}', '{r['subtopic'].replace(chr(39), chr(39)+chr(39))}', '{r['caps_ref']}', '{r['source_url']}')"
        values.append(val)

    sql_lines.append(",\n".join(values) + ";")
    return "\n".join(sql_lines)

def generate_poa_sql(poa_records, subject_codes):
    """Generate SQL for POA content"""
    subject_official_code, subject_alpha_code, subject_name = subject_codes

    sql_lines = []
    sql_lines.append(f"-- POA Template for {subject_name} ({subject_alpha_code})")
    sql_lines.append("USE nsc_qbank;")
    sql_lines.append("")

    if not poa_records:
        sql_lines.append("-- NO POA CONTENT FOUND")
        return "\n".join(sql_lines)

    sql_lines.append("INSERT INTO caps_poa_template (subject_official_code, subject_alpha_code, subject_name, grade, term, week_range, paper_no, paper_code, programme_of_assessment, weight_sba_pct, cognitive_level, caps_ref, source_url) VALUES")

    values = []
    for r in poa_records:
        term = r.get('term') if r.get('term') else 'NULL'
        weight = r.get('weight_sba_pct') if r.get('weight_sba_pct') else 'NULL'
        cognitive = f"'{r['cognitive_level']}'" if r.get('cognitive_level') else 'NULL'
        val = f"    ('{r['subject_official_code']}', '{r['subject_alpha_code']}', '{r['subject_name'].replace(chr(39), chr(39)+chr(39))}', {r['grade']}, {term}, '{r['week_range']}', {r['paper_no']}, '{r['paper_code']}', '{r['programme_of_assessment'].replace(chr(39), chr(39)+chr(39))}', {weight}, {cognitive}, '{r['caps_ref']}', '{r['source_url']}')"
        values.append(val)

    sql_lines.append(",\n".join(values) + ";")
    return "\n".join(sql_lines)

def process_single_pdf(pdf_path):
    filename = os.path.basename(pdf_path)
    subject_codes = identify_subject(filename)
    if not subject_codes:
        print(f"  SKIP: Not in SUBJECT_MAP: {filename}")
        return None

    subject_official_code, subject_alpha_code, subject_name = subject_codes
    print(f"  Processing: {filename} -> {subject_name} ({subject_alpha_code})")

    # Extract text from pages 20-100 (where Section 3 and 4 usually are)
    texts = extract_text_pages(pdf_path, 20, 100)

    # Find ATP (Section 3)
    atp_pages = find_section_3_atp(texts)
    print(f"    ATP pages found: {len(atp_pages)}")
    atp_records = parse_atp_content(atp_pages, subject_codes) if atp_pages else []
    print(f"    ATP records extracted: {len(atp_records)}")

    # Find POA (Section 4)
    poa_pages = find_section_4_poa(texts)
    print(f"    POA pages found: {len(poa_pages)}")
    poa_records = parse_poa_content(poa_pages, subject_codes) if poa_pages else []
    print(f"    POA records extracted: {len(poa_records)}")

    # Generate SQL
    atp_sql = generate_atp_sql(atp_records, subject_codes)
    poa_sql = generate_poa_sql(poa_records, subject_codes)

    return {
        "subject": subject_name,
        "subject_alpha_code": subject_alpha_code,
        "subject_official_code": subject_official_code,
        "atp_records": atp_records,
        "poa_records": poa_records,
        "atp_sql": atp_sql,
        "poa_sql": poa_sql,
        "atp_pages": len(atp_pages),
        "poa_pages": len(poa_pages)
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: python atp_poa_extractor.py <caps_folder_path>")
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
            # Save ATP SQL
            atp_sql_path = os.path.join(folder_path, f"atp_{result['subject_alpha_code'].lower()}.sql")
            with open(atp_sql_path, 'w', encoding='utf-8') as f:
                f.write(result['atp_sql'])
            print(f"    ✓ Saved ATP SQL: atp_{result['subject_alpha_code'].lower()}.sql")
            # Save POA SQL
            poa_sql_path = os.path.join(folder_path, f"poa_{result['subject_alpha_code'].lower()}.sql")
            with open(poa_sql_path, 'w', encoding='utf-8') as f:
                f.write(result['poa_sql'])
            print(f"    ✓ Saved POA SQL: poa_{result['subject_alpha_code'].lower()}.sql")

    json_path = os.path.join(folder_path, "atp_poa_results.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump({"processed": results, "timestamp": datetime.now().isoformat()}, f, indent=2, default=str)

    print(f"\n{'='*70}")
    print(f"BATCH COMPLETE: {len(results)}/{len(pdf_files)} subjects processed")
    if results:
        print(f"\n{'CODE':<8} | {'SUBJECT':<40} | {'ATP':<5} | {'POA':<5}")
        print(f"{'-'*70}")
        total_atp = 0
        total_poa = 0
        for r in results:
            print(f"{r['subject_alpha_code']:<8} | {r['subject']:<40} | {len(r['atp_records']):<5} | {len(r['poa_records']):<5}")
            total_atp += len(r['atp_records'])
            total_poa += len(r['poa_records'])
        print(f"{'-'*70}")
        print(f"TOTAL    | {'':<40} | {total_atp:<5} | {total_poa:<5}")
    print(f"\nResults saved to: {json_path}")

if __name__ == "__main__":
    main()
