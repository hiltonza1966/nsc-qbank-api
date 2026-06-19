#!/usr/bin/env python3
"""
QBank CAPS Missing Subjects Seeder - v8
Uses caps_subjects_master.subject_official_code (correct codes)
Seeds only the 19 missing subjects with topics from Excel
"""

import pandas as pd
import json
import re
from pathlib import Path
from collections import defaultdict

# Missing subjects with CORRECT official codes from caps_subjects_master
MISSING_SUBJECTS = {
    "10001114": ("Afrikaans First Additional Language", "AFAL"),
    "10001094": ("Afrikaans Home Language", "AFHL"),
    "10351054": ("Agricultural Sciences", "AGRI"),
    "10001204": ("Computer Applications Technology", "CATN"),
    "10001234": ("Consumer Studies", "CONS"),
    "11351084": ("Dramatic Arts", "DRAM"),
    "10001284": ("Engineering Graphics and Design", "EGDN"),
    "10001324": ("English First Additional Language", "ENFL"),
    "10001014": ("English Home Language", "ENGL"),
    "11351124": ("Hospitality Studies", "HTEL"),
    "10001404": ("Information Technology", "INFT"),
    "10001614": ("isiXhosa Home Language", "XHOS"),
    "10001594": ("isiZulu Home Language", "ZULU"),
    "10001424": ("Life Orientation", "LO"),
    "10001034": ("Life Sciences", "LFSC"),
    "11351154": ("Music", "MUSI"),
    "10001064": ("Physical Sciences", "PHYS"),
    "10001524": ("Sepedi Home Language", "SETH"),
    "11351184": ("Visual Arts", "VSLA"),
}

def get_strand(subject_name):
    """Infer strand from subject name"""
    subject_lower = subject_name.lower()
    if any(x in subject_lower for x in ['science', 'physical', 'life', 'agricultural']):
        return "'Natural Sciences'"
    elif 'math' in subject_lower:
        return "'Mathematics'"
    elif any(x in subject_lower for x in ['language', 'fal', 'home', 'xhosa', 'zulu', 'sepedi', 'sesotho', 'setswana', 'siswati', 'tshivenda', 'xitsonga', 'afrikaans', 'english']):
        return "'Languages'"
    elif any(x in subject_lower for x in ['tech', 'civil', 'electrical', 'mechanical', 'computer', 'information', 'engineering']):
        return "'Technology'"
    elif any(x in subject_lower for x in ['art', 'music', 'dance', 'drama', 'visual', 'design']):
        return "'Arts'"
    elif any(x in subject_lower for x in ['business', 'economics', 'accounting', 'consumer', 'tourism', 'hospitality']):
        return "'Economic & Management Sciences'"
    elif any(x in subject_lower for x in ['geography', 'history', 'religion']):
        return "'Human & Social Sciences'"
    elif any(x in subject_lower for x in ['sport', 'life orientation', 'maritime', 'nautical']):
        return "'Health & Wellness'"
    return "'General'"

def generate_seed_sql():
    excel_path = r"C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents\CAPS_Full_ATP_Master.xlsx"
    output_sql = r"C:\dev\nsc-qbank\sandbox\seed_missing_subjects_v8.sql"
    log_file = r"C:\dev\nsc-qbank\sandbox\seed_missing_v8.log"

    # Clear log
    with open(log_file, 'w', encoding='utf-8') as f:
        f.write("CAPS Missing Subjects Seeder v8\n")
        f.write("="*60 + "\n")

    def log(msg):
        print(msg)
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(msg + "\n")

    log("Reading CAPS_Full_ATP_Master.xlsx...")

    try:
        df = pd.read_excel(excel_path, sheet_name='ATP_Content_All')
    except Exception as e:
        log(f"ERROR reading Excel: {e}")
        return

    log(f"Total ATP rows: {len(df)}")
    log(f"Subjects in Excel: {df['subject'].nunique()}")
    log(f"Unique topics: {df['topic'].nunique()}")

    # Group by subject -> topic -> subtopics
    subject_topics = defaultdict(lambda: defaultdict(lambda: {
        'subtopics': set(),
        'grades': set(),
        'terms': set(),
        'caps_refs': set(),
        'weeks': set()
    }))

    for _, row in df.iterrows():
        subject = str(row['subject']).strip()
        topic = str(row['topic']).strip()
        subtopic = str(row['subtopic']).strip() if pd.notna(row['subtopic']) else ''
        grade = str(row['grade']).strip() if pd.notna(row['grade']) else ''
        term = str(row['term']).strip() if pd.notna(row['term']) else ''
        week = str(row['week']).strip() if pd.notna(row['week']) else ''
        caps_ref = str(row['caps_ref']).strip() if pd.notna(row['caps_ref']) else ''

        if topic:
            if subtopic and subtopic not in subject_topics[subject][topic]['subtopics']:
                subject_topics[subject][topic]['subtopics'].add(subtopic)
            if grade:
                subject_topics[subject][topic]['grades'].add(grade)
            if term:
                subject_topics[subject][topic]['terms'].add(term)
            if week:
                subject_topics[subject][topic]['weeks'].add(week)
            if caps_ref:
                subject_topics[subject][topic]['caps_refs'].add(caps_ref)

    # Generate SQL
    sql_lines = []
    sql_lines.append("-- ============================================")
    sql_lines.append("-- CAPS Missing Subjects Seed Data - v8")
    sql_lines.append("-- Uses caps_subjects_master.subject_official_code")
    sql_lines.append("-- Generated from CAPS_Full_ATP_Master.xlsx")
    sql_lines.append("-- ============================================")
    sql_lines.append("")
    sql_lines.append("USE nsc_qbank;")
    sql_lines.append("")
    sql_lines.append("SET FOREIGN_KEY_CHECKS = 0;")
    sql_lines.append("")

    topic_count = 0
    subtopic_count = 0
    topic_counter = 96  # Start after existing 95 topics

    subjects_seeded = 0

    for subject_code, (subject_name, alpha_code) in sorted(MISSING_SUBJECTS.items()):
        log(f"\nProcessing: {subject_name} ({subject_code})")

        # Find this subject in the parsed data
        subject_data = None
        for parsed_subject in subject_topics.keys():
            if (subject_name.lower() in parsed_subject.lower() or 
                alpha_code.lower() in parsed_subject.lower() or
                subject_name.split()[0].lower() in parsed_subject.lower()):
                subject_data = subject_topics[parsed_subject]
                log(f"  Found in Excel as: {parsed_subject}")
                break

        if not subject_data:
            log(f"  ⚠ No data found in Excel for {subject_name}")
            continue

        subjects_seeded += 1
        sql_lines.append(f"-- {'='*60}")
        sql_lines.append(f"-- Subject: {subject_name} ({subject_code})")
        sql_lines.append(f"-- {'='*60}")

        display_order = 0

        for topic_name, topic_data in sorted(subject_data.items()):
            topic_count += 1
            display_order += 10

            topic_clean = topic_name.replace("'", "''")[:255]

            grades_list = sorted(topic_data['grades'])
            grade_number = grades_list[0] if grades_list else 'NULL'
            if grade_number != 'NULL':
                try:
                    grade_number = int(re.match(r'(\d+)', str(grade_number)).group(1))
                except:
                    grade_number = 'NULL'

            terms_list = sorted(topic_data['terms'])
            term = str(terms_list[0]) if terms_list else 'NULL'
            if term != 'NULL':
                term = f"'{term}'"

            topic_code = f"'CAPS{topic_counter:04d}'"
            topic_counter += 1

            description = f"CAPS topic for {subject_name}"
            if grades_list:
                description += f" | Grades: {', '.join(grades_list)}"
            if topic_data['caps_refs']:
                refs = ', '.join(sorted(topic_data['caps_refs']))[:100]
                description += f" | Ref: {refs}"
            description = description.replace("'", "''")[:500]

            strand = get_strand(subject_name)

            sql_lines.append(f"")
            sql_lines.append(f"-- Topic: {topic_name}")
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
            sql_lines.append(f"    '{subject_code}',")  # FIXED: Use correct code directly
            sql_lines.append(f"    NULL,")
            sql_lines.append(f"    {grade_number},")
            sql_lines.append(f"    {strand},")
            sql_lines.append(f"    {term},")
            sql_lines.append(f"    {topic_code},")
            sql_lines.append(f"    '{topic_clean}',")
            sql_lines.append(f"    NULL,")
            sql_lines.append(f"    NULL,")
            sql_lines.append(f"    NULL,")
            sql_lines.append(f"    '{description}',")
            sql_lines.append(f"    1,")
            sql_lines.append(f"    {display_order}")
            sql_lines.append(f");")
            sql_lines.append(f"")
            sql_lines.append(f"SET @topic_id = LAST_INSERT_ID();")
            sql_lines.append(f"")

            sub_display_order = 0
            for subtopic_name in sorted(topic_data['subtopics']):
                if subtopic_name and subtopic_name != topic_name:
                    subtopic_count += 1
                    sub_display_order += 10
                    subtopic_clean = subtopic_name.replace("'", "''")[:255]

                    subtopic_code = re.sub(r'[^a-zA-Z0-9]', '_', subtopic_name[:20]).upper()

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
                    sql_lines.append(f"    '{subtopic_clean}',")
                    sql_lines.append(f"    'CAPS subtopic: {subtopic_clean}',")
                    sql_lines.append(f"    1,")
                    sql_lines.append(f"    {sub_display_order}")
                    sql_lines.append(f");")

            sql_lines.append("")

    sql_lines.append("SET FOREIGN_KEY_CHECKS = 1;")
    sql_lines.append("")
    sql_lines.append(f"-- ============================================")
    sql_lines.append(f"-- TOTALS: {topic_count} topics, {subtopic_count} subtopics")
    sql_lines.append(f"-- Subjects seeded: {subjects_seeded}/{len(MISSING_SUBJECTS)}")
    sql_lines.append(f"-- ============================================")

    with open(output_sql, 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_lines))

    log(f"\n{'='*60}")
    log(f"✓ SQL saved to: {output_sql}")
    log(f"✓ Topics: {topic_count}")
    log(f"✓ Subtopics: {subtopic_count}")
    log(f"✓ Subjects: {subjects_seeded}/{len(MISSING_SUBJECTS)}")
    log(f"{'='*60}")

    summary = {
        'total_subjects': subjects_seeded,
        'total_topics': topic_count,
        'total_subtopics': subtopic_count,
        'subjects_seeded': {k: v for k, v in MISSING_SUBJECTS.items() if any(k in str(s) for s in subject_topics.keys())}
    }

    with open("caps_seed_missing_summary.json", 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)

    log(f"✓ Summary saved to: caps_seed_missing_summary.json")


if __name__ == "__main__":
    generate_seed_sql()
