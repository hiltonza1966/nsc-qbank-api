#!/usr/bin/env python3
"""
QBank CAPS Database Seeder - FIXED v3
Makes topic_code unique by prefixing with subject code.
"""

import pandas as pd
import json
import re
from pathlib import Path
from collections import defaultdict

def generate_seed_sql():
    excel_path = r"C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents\CAPS_Full_ATP_Master.xlsx"

    print("Reading CAPS_Full_ATP_Master.xlsx...")
    df = pd.read_excel(excel_path, sheet_name='ATP_Content_All')

    print(f"Total ATP rows: {len(df)}")
    print(f"Subjects: {df['subject'].nunique()}")
    print(f"Unique topics: {df['topic'].nunique()}")

    # Group by subject → topic → subtopics
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
    sql_lines.append("-- CAPS Topics & Subtopics Seed Data")
    sql_lines.append("-- Generated from CAPS_Full_ATP_Master.xlsx")
    sql_lines.append("-- FIXED v3: unique topic_code with subject prefix")
    sql_lines.append("-- ============================================")
    sql_lines.append("")
    sql_lines.append("USE nsc_qbank;")
    sql_lines.append("")
    sql_lines.append("SET FOREIGN_KEY_CHECKS = 0;")
    sql_lines.append("")

    topic_count = 0
    subtopic_count = 0

    for subject, topics in sorted(subject_topics.items()):
        sql_lines.append(f"-- {'='*60}")
        sql_lines.append(f"-- Subject: {subject}")
        sql_lines.append(f"-- {'='*60}")

        display_order = 0

        # Generate subject prefix for topic_code
        subject_prefix = re.sub(r'[^a-zA-Z0-9]', '', subject[:5]).upper()

        for topic_name, topic_data in sorted(topics.items()):
            topic_count += 1
            display_order += 10

            # Clean values for SQL
            topic_clean = topic_name.replace("'", "''")[:255]

            # Extract grade_number from grades
            grades_list = sorted(topic_data['grades'])
            grade_number = grades_list[0] if grades_list else 'NULL'
            if grade_number != 'NULL':
                try:
                    grade_number = int(re.match(r'(\d+)', str(grade_number)).group(1))
                except:
                    grade_number = 'NULL'

            # Extract term
            terms_list = sorted(topic_data['terms'])
            term = str(terms_list[0]) if terms_list else 'NULL'
            if term != 'NULL':
                term = f"'{term}'"

            # FIXED: Generate unique topic_code with subject prefix
            topic_code = re.sub(r'[^a-zA-Z0-9]', '_', topic_name[:15]).upper()
            topic_code = f"{subject_prefix}_{topic_code}"
            topic_code = f"'{topic_code}'"

            # Description
            description = f"CAPS topic for {subject}"
            if grades_list:
                description += f" | Grades: {', '.join(grades_list)}"
            if topic_data['caps_refs']:
                refs = ', '.join(sorted(topic_data['caps_refs']))[:100]
                description += f" | Ref: {refs}"
            description = description.replace("'", "''")[:500]

            # Strand inference
            strand = 'NULL'
            if 'Science' in subject or 'Physical' in subject or 'Life' in subject:
                strand = "'Natural Sciences'"
            elif 'Math' in subject:
                strand = "'Mathematics'"
            elif 'Language' in subject or 'FAL' in subject or 'Home' in subject:
                strand = "'Languages'"
            elif 'Tech' in subject or 'Civil' in subject or 'Electrical' in subject or 'Mechanical' in subject:
                strand = "'Technology'"
            elif 'Art' in subject or 'Music' in subject or 'Dance' in subject or 'Drama' in subject or 'Visual' in subject:
                strand = "'Arts'"
            elif 'Business' in subject or 'Economics' in subject or 'Accounting' in subject:
                strand = "'Economic & Management Sciences'"
            elif 'Geography' in subject or 'History' in subject:
                strand = "'Human & Social Sciences'"
            elif 'Agricultural' in subject:
                strand = "'Agriculture'"
            elif 'Tourism' in subject or 'Hospitality' in subject:
                strand = "'Services'"
            elif 'Sport' in subject or 'Life Orientation' in subject:
                strand = "'Health & Wellness'"

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
            sql_lines.append(f"    (SELECT subject_official_code FROM lookup_subjects WHERE subject_name = '{subject.replace("'", "''")}' LIMIT 1),")
            sql_lines.append(f"    NULL,")
            sql_lines.append(f"    {grade_number},")
            sql_lines.append(f"    {strand},")
            sql_lines.append(f"    {term},")
            sql_lines.append(f"    {topic_code},")  # FIXED: unique with subject prefix
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

            # Subtopics
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
    sql_lines.append(f"-- ============================================")

    sql_file = "caps_atp_seed_v3.sql"
    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_lines))

    print(f"\n✓ Fixed SQL v3 saved to: {sql_file}")
    print(f"✓ Topics: {topic_count}")
    print(f"✓ Subtopics: {subtopic_count}")

    summary = {
        'total_subjects': len(subject_topics),
        'total_topics': topic_count,
        'total_subtopics': subtopic_count,
        'subjects': {s: len(t) for s, t in subject_topics.items()}
    }

    with open("caps_seed_summary.json", 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)

    print(f"✓ Summary saved to: caps_seed_summary.json")
    print("\nSubjects and topic counts:")
    for subject, topic_count in sorted(summary['subjects'].items()):
        print(f"  {subject}: {topic_count} topics")


if __name__ == "__main__":
    generate_seed_sql()
