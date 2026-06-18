#!/usr/bin/env python3
"""
QBank CAPS Database Seeder
Reads CAPS_Full_ATP_Master.xlsx and generates SQL for:
- lookup_caps_topics
- lookup_caps_subtopics
"""

import pandas as pd
import json
from pathlib import Path
from collections import defaultdict

def generate_seed_sql():
    excel_path = r"C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents\CAPS_Full_ATP_Master.xlsx"

    print("Reading CAPS_Full_ATP_Master.xlsx...")

    # Read ATP_Content_All sheet
    df = pd.read_excel(excel_path, sheet_name='ATP_Content_All')

    print(f"Total ATP rows: {len(df)}")
    print(f"Subjects: {df['subject'].nunique()}")
    print(f"Topics: {df['topic'].nunique()}")
    print(f"Subtopics: {df['subtopic'].nunique()}")

    # Group by subject → topic → subtopics
    subject_topics = defaultdict(lambda: defaultdict(list))

    for _, row in df.iterrows():
        subject = str(row['subject']).strip()
        topic = str(row['topic']).strip()
        subtopic = str(row['subtopic']).strip() if pd.notna(row['subtopic']) else ''
        grade = str(row['grade']).strip() if pd.notna(row['grade']) else ''
        term = str(row['term']).strip() if pd.notna(row['term']) else ''
        week = str(row['week']).strip() if pd.notna(row['week']) else ''
        caps_ref = str(row['caps_ref']).strip() if pd.notna(row['caps_ref']) else ''

        if topic and topic not in subject_topics[subject][topic]:
            subject_topics[subject][topic] = {
                'subtopics': set(),
                'grades': set(),
                'terms': set(),
                'caps_refs': set()
            }

        if subtopic:
            subject_topics[subject][topic]['subtopics'].add(subtopic)
        if grade:
            subject_topics[subject][topic]['grades'].add(grade)
        if term:
            subject_topics[subject][topic]['terms'].add(term)
        if caps_ref:
            subject_topics[subject][topic]['caps_refs'].add(caps_ref)

    # Generate SQL
    sql_lines = []
    sql_lines.append("-- ============================================")
    sql_lines.append("-- CAPS Topics & Subtopics Seed Data")
    sql_lines.append("-- Generated from CAPS_Full_ATP_Master.xlsx")
    sql_lines.append("-- ============================================")
    sql_lines.append("")
    sql_lines.append("USE nsc_qbank;")
    sql_lines.append("")

    topic_count = 0
    subtopic_count = 0

    for subject, topics in sorted(subject_topics.items()):
        sql_lines.append(f"-- {'='*50}")
        sql_lines.append(f"-- Subject: {subject}")
        sql_lines.append(f"-- {'='*50}")

        for topic_name, topic_data in sorted(topics.items()):
            topic_count += 1

            # Clean topic name for SQL
            topic_clean = topic_name.replace("'", "''")
            grades = ', '.join(sorted(topic_data['grades'])) if topic_data['grades'] else '10-12'
            terms = ', '.join(sorted(topic_data['terms'])) if topic_data['terms'] else ''
            caps_refs = ', '.join(sorted(topic_data['caps_refs'])) if topic_data['caps_refs'] else ''

            description = f"CAPS topic for {subject} (Grades {grades})"
            if caps_refs:
                description += f" | Ref: {caps_refs}"

            sql_lines.append(f"")
            sql_lines.append(f"-- Topic: {topic_name}")
            sql_lines.append(f"INSERT INTO lookup_caps_topics (subject_official_code, topic_name, description, grade_range, term_range, caps_reference, created_at)")
            sql_lines.append(f"SELECT ls.subject_official_code, '{topic_clean}', '{description}', '{grades}', '{terms}', '{caps_refs}', NOW()")
            sql_lines.append(f"FROM lookup_subjects ls WHERE ls.name = '{subject.replace("'", "''")}' LIMIT 1;")
            sql_lines.append(f"")
            sql_lines.append(f"SET @topic_id = LAST_INSERT_ID();")
            sql_lines.append(f"")

            # Subtopics
            for subtopic_name in sorted(topic_data['subtopics']):
                if subtopic_name and subtopic_name != topic_name:
                    subtopic_count += 1
                    subtopic_clean = subtopic_name.replace("'", "''")[:500]  # Limit length

                    sql_lines.append(f"INSERT INTO lookup_caps_subtopics (topic_id, subtopic_name, description, created_at)")
                    sql_lines.append(f"VALUES (@topic_id, '{subtopic_clean}', 'CAPS subtopic: {subtopic_clean}', NOW());")

            sql_lines.append("")

    sql_lines.append(f"-- ============================================")
    sql_lines.append(f"-- TOTALS: {topic_count} topics, {subtopic_count} subtopics")
    sql_lines.append(f"-- ============================================")

    # Save SQL
    sql_file = "caps_atp_seed.sql"
    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_lines))

    print(f"\n✓ SQL saved to: {sql_file}")
    print(f"✓ Topics: {topic_count}")
    print(f"✓ Subtopics: {subtopic_count}")

    # Also generate summary JSON
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
