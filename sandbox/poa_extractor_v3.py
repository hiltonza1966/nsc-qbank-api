#!/usr/bin/env python3
"""
POA Extractor V3 - Links to actual topics/subtopics
"""

import fitz
import sys
import os
import re
import json
from datetime import datetime

SUBJECT_MAP = {
    "CAPS FET PHYSICAL SCIENCE WEB.pdf": ("19351114", "PHSC", "Physical Sciences"),
    "CAPS FET _ ACCOUNTING GR 10-12 _ Web_CAB3.pdf": ("12351024", "ACCN", "Accounting"),
    "CAPS FET _ BUSINESS STUDIES _ GR 10-12 _ Web_0CA7.pdf": ("12351054", "BSTD", "Business Studies"),
    "CAPS FET _ ECONOMICS _ GR 10-12 _ WEB_BD13.pdf": ("12351084", "ECON", "Economics"),
    "CAPS FET _ GEOGRAPHY _ GR 10-12 _ WEB_C9A9.pdf": ("16351054", "GEOG", "Geography"),
    "CAPS FET _ MATHEMATICAL LITERACY _ GR 10-12 _ Web_DDA9.pdf": ("19321024", "MLIT", "Mathematical Literacy"),
    "CAPS FET _ MATHEMATICS _ GR 10-12 _ Web_1133.pdf": ("19331054", "MATH", "Mathematics"),
    "CAPS FET _ TOURISM _ GR 10-12 Web_1FAC.pdf": ("20351084", "TRSM", "Tourism"),
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

def find_poa_section(texts):
    """Find Section 4: Programme of Assessment"""
    poa_texts = []
    in_section = False
    for text in texts:
        text_upper = text.upper()
        if ("SECTION 4" in text_upper and ("ASSESSMENT" in text_upper or "PROGRAMME" in text_upper)) or \
           ("PROGRAMME OF ASSESSMENT" in text_upper):
            in_section = True
            poa_texts.append(text)
            continue
        if in_section:
            if any(marker in text_upper for marker in ["SECTION 5", "APPENDIX", "GLOSSARY"]):
                if len(poa_texts) > 2:
                    break
            poa_texts.append(text)
            if len(poa_texts) > 10:
                break
    return poa_texts

def parse_poa(poa_texts, subject_codes):
    """Parse POA and link to topics"""
    subject_official_code, subject_alpha_code, subject_name = subject_codes
    records = []

    full_text = "\n".join(poa_texts)
    lines = [l.strip() for l in full_text.split('\n') if l.strip()]

    current_term = None
    current_grade = 10

    for line in lines:
        line_upper = line.upper()

        # Detect term
        term_match = re.search(r'Term\s*(1|2|3|4)', line, re.IGNORECASE)
        if term_match:
            current_term = term_match.group(1)
            continue

        # Detect grade
        grade_match = re.search(r'Grade\s*(10|11|12)', line, re.IGNORECASE)
        if grade_match:
            current_grade = int(grade_match.group(1))
            continue

        # Look for assessment patterns
        # e.g., "Test: 20%", "Exam: 30%", "PAT: 25%"
        assess_match = re.search(r'(Test|Exam|Assignment|Project|Practical|PAT|SBA|Mid-year|Final)\s*[:\-]?\s*(\d+)?%?', line, re.IGNORECASE)
        if assess_match:
            assess_type = assess_match.group(1)
            weight = assess_match.group(2)

            # Try to find associated topic from nearby lines
            topic = "General"
            subtopic = ""

            records.append({
                "subject_official_code": subject_official_code,
                "subject_alpha_code": subject_alpha_code,
                "subject_name": subject_name,
                "grade": current_grade,
                "term": current_term if current_term else "1",
                "week_range": "",
                "paper_no": 1,
                "paper_code": f"{subject_alpha_code}-P1",
                "topic": topic,
                "subtopic": subtopic,
                "programme_of_assessment": assess_type,
                "weight_sba_pct": float(weight) if weight else None,
                "cognitive_level": None,
                "caps_ref": "",
                "source_url": ""
            })

    return records

def generate_poa_sql(records, subject_codes):
    subject_official_code, subject_alpha_code, subject_name = subject_codes

    sql_lines = []
    sql_lines.append(f"-- POA for {subject_name} ({subject_alpha_code})")
    sql_lines.append("USE nsc_qbank;")
    sql_lines.append("")

    if not records:
        sql_lines.append("-- NO POA CONTENT FOUND")
        return "\n".join(sql_lines)

    sql_lines.append("INSERT INTO caps_poa_template (subject_official_code, subject_alpha_code, subject_name, grade, term, week_range, paper_no, paper_code, topic, subtopic, programme_of_assessment, weight_sba_pct, cognitive_level, caps_ref, source_url) VALUES")

    values = []
    for r in records:
        weight = r.get('weight_sba_pct') if r.get('weight_sba_pct') else 'NULL'
        cognitive = f"'{r['cognitive_level']}'" if r.get('cognitive_level') else 'NULL'
        topic = r.get('topic', '').replace("'", "''")
        subtopic = r.get('subtopic', '').replace("'", "''")
        poa = r.get('programme_of_assessment', '').replace("'", "''")
        val = f"    ('{r['subject_official_code']}', '{r['subject_alpha_code']}', '{r['subject_name'].replace(chr(39), chr(39)+chr(39))}', {r['grade']}, '{r['term']}', '{r['week_range']}', {r['paper_no']}, '{r['paper_code']}', '{topic}', '{subtopic}', '{poa}', {weight}, {cognitive}, '{r['caps_ref']}', '{r['source_url']}')"
        values.append(val)

    sql_lines.append(",\n".join(values) + ";")
    return "\n".join(sql_lines)

def process_single_pdf(pdf_path):
    filename = os.path.basename(pdf_path)
    subject_codes = identify_subject(filename)
    if not subject_codes:
        return None

    subject_official_code, subject_alpha_code, subject_name = subject_codes
    print(f"  Processing POA: {filename} -> {subject_name}")

    texts = extract_text_pages(pdf_path, 20, 100)
    poa_texts = find_poa_section(texts)
    print(f"    POA pages: {len(poa_texts)}")

    records = parse_poa(poa_texts, subject_codes) if poa_texts else []
    print(f"    POA records: {len(records)}")

    sql = generate_poa_sql(records, subject_codes)
    return {
        "subject": subject_name,
        "subject_alpha_code": subject_alpha_code,
        "records": records,
        "sql": sql
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: python poa_extractor_v3.py <caps_folder_path>")
        sys.exit(1)

    folder_path = sys.argv[1]
    pdf_files = [f for f in os.listdir(folder_path) if f.lower().endswith('.pdf') and os.path.isfile(os.path.join(folder_path, f))]
    pdf_files.sort()

    print(f"Found {len(pdf_files)} PDF files")
    results = []
    for pdf_file in pdf_files:
        pdf_path = os.path.join(folder_path, pdf_file)
        result = process_single_pdf(pdf_path)
        if result:
            results.append(result)
            sql_path = os.path.join(folder_path, f"poa_v3_{result['subject_alpha_code'].lower()}.sql")
            with open(sql_path, 'w', encoding='utf-8') as f:
                f.write(result['sql'])
            print(f"    ✓ Saved: poa_v3_{result['subject_alpha_code'].lower()}.sql")

    print(f"\nProcessed {len(results)} subjects")
    total_records = sum(len(r['records']) for r in results)
    print(f"Total POA records: {total_records}")

if __name__ == "__main__":
    main()
