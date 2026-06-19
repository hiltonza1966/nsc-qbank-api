#!/usr/bin/env python3
"""
POA Extractor V2 - Proper term/week extraction
Parses POA tables to extract:
- Term (1-4)
- Week range
- Assessment type
- Weight
- Cognitive level
"""

import fitz
import sys
import os
import re
import json
from datetime import datetime

SUBJECT_MAP = {
    # Same mapping as before...
    "CAPS FET PHYSICAL SCIENCE WEB.pdf": ("19351114", "PHSC", "Physical Sciences"),
    "CAPS FET _ ACCOUNTING GR 10-12 _ Web_CAB3.pdf": ("12351024", "ACCN", "Accounting"),
    "CAPS FET _ BUSINESS STUDIES _ GR 10-12 _ Web_0CA7.pdf": ("12351054", "BSTD", "Business Studies"),
    "CAPS FET _ ECONOMICS _ GR 10-12 _ WEB_BD13.pdf": ("12351084", "ECON", "Economics"),
    "CAPS FET _ GEOGRAPHY _ GR 10-12 _ WEB_C9A9.pdf": ("16351054", "GEOG", "Geography"),
    "CAPS FET _ MATHEMATICAL LITERACY _ GR 10-12 _ Web_DDA9.pdf": ("19321024", "MLIT", "Mathematical Literacy"),
    "CAPS FET _ MATHEMATICS _ GR 10-12 _ Web_1133.pdf": ("19331054", "MATH", "Mathematics"),
    "CAPS FET _ TOURISM _ GR 10-12 Web_1FAC.pdf": ("20351084", "TRSM", "Tourism"),
    # ... (all other subjects)
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

def find_poa_tables(texts):
    """Find POA tables with term/week/assessment data"""
    poa_data = []
    current_term = None

    for text in texts:
        lines = [l.strip() for l in text.split('\n') if l.strip()]

        for line in lines:
            line_upper = line.upper()

            # Detect term headers
            term_match = re.search(r'Term\s*(1|2|3|4)', line, re.IGNORECASE)
            if term_match:
                current_term = int(term_match.group(1))
                continue

            # Detect assessment rows with week info
            # Patterns: "Week 5: Test", "Week 10-15: Assignment", etc.
            week_assess_match = re.search(r'Week\s*(\d+)(?:\s*-\s*(\d+))?\s*[:\-]?\s*(.+)', line, re.IGNORECASE)
            if week_assess_match and current_term:
                start_week = week_assess_match.group(1)
                end_week = week_assess_match.group(2) if week_assess_match.group(2) else start_week
                assessment = week_assess_match.group(3).strip()

                # Extract weight
                weight_match = re.search(r'(\d+)%', assessment)
                weight = float(weight_match.group(1)) if weight_match else None

                # Extract cognitive level
                cognitive = None
                assess_upper = assessment.upper()
                if any(word in assess_upper for word in ['KNOWLEDGE', 'REMEMBER', 'LEVEL 1', 'LOWER']):
                    cognitive = 'Lower'
                elif any(word in assess_upper for word in ['APPLICATION', 'UNDERSTAND', 'LEVEL 2', 'MIDDLE']):
                    cognitive = 'Middle'
                elif any(word in assess_upper for word in ['ANALYSIS', 'EVALUATE', 'LEVEL 3', 'HIGHER']):
                    cognitive = 'Higher'

                poa_data.append({
                    'term': current_term,
                    'week_range': f"{start_week}-{end_week}",
                    'assessment': assessment[:100],
                    'weight': weight,
                    'cognitive': cognitive
                })
                continue

            # Alternative pattern: table rows with tab-separated or space-separated data
            # e.g., "Term 1  Week 5  Test  20%  Lower"
            table_match = re.search(r'(Term\s*\d)?\s*Week\s*(\d+)(?:\s*-\s*(\d+))?\s*(.+?)\s*(\d+)%?\s*(Lower|Middle|Higher)?', line, re.IGNORECASE)
            if table_match and not week_assess_match:
                term_str = table_match.group(1)
                if term_str:
                    current_term = int(re.search(r'\d', term_str).group())
                start_week = table_match.group(2)
                end_week = table_match.group(3) if table_match.group(3) else start_week
                assessment = table_match.group(4).strip()
                weight = float(table_match.group(5)) if table_match.group(5) else None
                cognitive = table_match.group(6)

                if current_term:
                    poa_data.append({
                        'term': current_term,
                        'week_range': f"{start_week}-{end_week}",
                        'assessment': assessment[:100],
                        'weight': weight,
                        'cognitive': cognitive
                    })

    return poa_data

def parse_poa(texts, subject_codes):
    """Parse POA content with proper term/week extraction"""
    subject_official_code, subject_alpha_code, subject_name = subject_codes

    # Find Section 4
    section_4_texts = []
    in_section_4 = False
    for text in texts:
        text_upper = text.upper()
        if "SECTION 4" in text_upper and ("ASSESSMENT" in text_upper or "PROGRAMME" in text_upper):
            in_section_4 = True
        if in_section_4:
            section_4_texts.append(text)
            if any(marker in text_upper for marker in ["SECTION 5", "APPENDIX", "GLOSSARY"]):
                if len(section_4_texts) > 3:
                    break

    if not section_4_texts:
        return []

    # Extract POA tables
    poa_data = find_poa_tables(section_4_texts)

    # Build records
    records = []
    for item in poa_data:
        records.append({
            "subject_official_code": subject_official_code,
            "subject_alpha_code": subject_alpha_code,
            "subject_name": subject_name,
            "grade": 10,  # Default - should detect per grade
            "term": item['term'],
            "week_range": item['week_range'],
            "paper_no": 1,
            "paper_code": f"{subject_alpha_code}-P1",
            "programme_of_assessment": item['assessment'],
            "weight_sba_pct": item['weight'],
            "cognitive_level": item['cognitive'],
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

    sql_lines.append("INSERT INTO caps_poa_template (subject_official_code, subject_alpha_code, subject_name, grade, term, week_range, paper_no, paper_code, programme_of_assessment, weight_sba_pct, cognitive_level, caps_ref, source_url) VALUES")

    values = []
    for r in records:
        weight = r.get('weight_sba_pct') if r.get('weight_sba_pct') else 'NULL'
        cognitive = f"'{r['cognitive_level']}'" if r.get('cognitive_level') else 'NULL'
        val = f"    ('{r['subject_official_code']}', '{r['subject_alpha_code']}', '{r['subject_name'].replace(chr(39), chr(39)+chr(39))}', {r['grade']}, {r['term']}, '{r['week_range']}', {r['paper_no']}, '{r['paper_code']}', '{r['programme_of_assessment'].replace(chr(39), chr(39)+chr(39))}', {weight}, {cognitive}, '{r['caps_ref']}', '{r['source_url']}')"
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
    records = parse_poa(texts, subject_codes)
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
        print("Usage: python poa_extractor_v2.py <caps_folder_path>")
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
            sql_path = os.path.join(folder_path, f"poa_v2_{result['subject_alpha_code'].lower()}.sql")
            with open(sql_path, 'w', encoding='utf-8') as f:
                f.write(result['sql'])
            print(f"    ✓ Saved: poa_v2_{result['subject_alpha_code'].lower()}.sql")

    print(f"\nProcessed {len(results)} subjects")
    total_records = sum(len(r['records']) for r in results)
    print(f"Total POA records: {total_records}")

if __name__ == "__main__":
    main()
