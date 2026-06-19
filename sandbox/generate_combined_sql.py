#!/usr/bin/env python3
"""
Generate combined SQL import file from batch_caps_results_v3.json
"""

import json
import sys
import os
from datetime import datetime

def escape_sql(value):
    """Escape single quotes for SQL"""
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"

def generate_combined_sql(json_path, output_path):
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    processed = data.get('processed', [])

    sql_lines = []
    sql_lines.append("-- Combined CAPS Topics Import")
    sql_lines.append(f"-- Generated: {datetime.now().isoformat()}")
    sql_lines.append("-- Subjects: 24 non-language CAPS documents")
    sql_lines.append("")
    sql_lines.append("USE nsc_qbank;")
    sql_lines.append("")
    sql_lines.append("SET FOREIGN_KEY_CHECKS = 0;")
    sql_lines.append("")

    all_topics = []
    all_subtopics = []

    for subject_data in processed:
        subject_alpha = subject_data['subject_alpha_code']
        subject_name = subject_data['subject']
        subject_official = subject_data['subject_official_code']

        topics = subject_data.get('topics', [])
        subtopics = subject_data.get('subtopics', [])

        if not topics:
            continue

        sql_lines.append(f"-- ============================================")
        sql_lines.append(f"-- {subject_name} ({subject_alpha}) - {len(topics)} topics, {len(subtopics)} subtopics")
        sql_lines.append(f"-- ============================================")
        sql_lines.append("")

        # Generate topic INSERTs
        sql_lines.append(f"INSERT INTO lookup_caps_topics ")
        sql_lines.append(f"(subject_official_code, grade_number, strand, term, topic_code, topic_name, topic_weighting, time_weeks, paper_no, description, is_active, display_order)")
        sql_lines.append(f"VALUES")

        topic_values = []
        for t in topics:
            grade = t.get('grade_number') if t.get('grade_number') is not None else 'NULL'
            term = escape_sql(t.get('term'))
            weight = t.get('topic_weighting') if t.get('topic_weighting') is not None else 'NULL'
            time_w = t.get('time_weeks') if t.get('time_weeks') is not None else 'NULL'
            paper = t.get('paper_no') if t.get('paper_no') is not None else 'NULL'
            desc = escape_sql(t.get('description', ''))

            val = f"    ({escape_sql(t['subject_official_code'])}, {grade}, {escape_sql(t.get('strand', ''))}, {term}, {escape_sql(t['topic_code'])}, {escape_sql(t['topic_name'])}, {weight}, {time_w}, {paper}, {desc}, 1, {t.get('display_order', 0)})"
            topic_values.append(val)

        sql_lines.append(",\n".join(topic_values) + ";")
        sql_lines.append("")

        # Store subtopics for later insertion (need topic_id from DB)
        all_subtopics.extend(subtopics)

    # Subtopics section
    if all_subtopics:
        sql_lines.append("-- ============================================")
        sql_lines.append("-- SUBTOPICS (Insert after topics to get topic_id)")
        sql_lines.append("-- ============================================")
        sql_lines.append("")
        sql_lines.append("-- Subtopics require topic_id from lookup_caps_topics")
        sql_lines.append("-- Use the following pattern:")
        sql_lines.append("-- INSERT INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, description, is_active, display_order)")
        sql_lines.append("-- SELECT t.topic_id, 'SUBCODE', 'Name', 'Desc', 1, 1")
        sql_lines.append("-- FROM lookup_caps_topics t WHERE t.topic_code = 'TOPIC_CODE';")
        sql_lines.append("")

        for s in all_subtopics:
            sql_lines.append(f"-- {s.get('subtopic_code', 'UNKNOWN')}: {s.get('subtopic_name', '')[:60]} (Topic: {s.get('topic_code', 'UNKNOWN')})")

    sql_lines.append("")
    sql_lines.append("SET FOREIGN_KEY_CHECKS = 1;")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_lines))

    print(f"Combined SQL saved to: {output_path}")
    print(f"Total subjects: {len(processed)}")
    print(f"Total topics: {sum(len(s.get('topics', [])) for s in processed)}")
    print(f"Total subtopics: {len(all_subtopics)}")

if __name__ == "__main__":
    json_path = r"C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents\batch_caps_results_v3.json"
    output_path = r"C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents\combined_caps_import.sql"

    generate_combined_sql(json_path, output_path)
