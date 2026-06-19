#!/usr/bin/env python3
"""
Subtopic Importer
Reads v5 JSON results and generates SQL to insert subtopics with correct topic_id
"""

import json
import sys
import os

def generate_subtopic_sql(json_path, output_path):
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    processed = data.get('processed', [])

    sql_lines = []
    sql_lines.append("-- Subtopic Import")
    sql_lines.append("-- Generated from batch_caps_results_v5.json")
    sql_lines.append("")
    sql_lines.append("USE nsc_qbank;")
    sql_lines.append("")

    total_subtopics = 0

    for subject_data in processed:
        subject_alpha = subject_data['subject_alpha_code']
        subject_name = subject_data['subject']
        subtopics = subject_data.get('subtopics', [])

        if not subtopics:
            continue

        sql_lines.append(f"-- {subject_name} ({subject_alpha}) - {len(subtopics)} subtopics")

        for s in subtopics:
            topic_code = s.get('topic_code', '')
            subtopic_name = s.get('subtopic_name', '')[:100].replace("'", "''")
            description = s.get('description', '').replace("'", "''")
            grade = s.get('grade_number') if s.get('grade_number') else 'NULL'
            display_order = s.get('display_order', 0)

            # Use JOIN to get topic_id from topic_code
            sql_lines.append(f"INSERT INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, description, grade_number, is_active, display_order)")
            sql_lines.append(f"SELECT t.topic_id, '{s.get('subtopic_code', 'UNKNOWN')}', '{subtopic_name}', '{description}', {grade}, 1, {display_order}")
            sql_lines.append(f"FROM lookup_caps_topics t WHERE t.topic_code = '{topic_code}';")
            sql_lines.append("")
            total_subtopics += 1

        sql_lines.append("")

    sql_lines.append(f"-- Total subtopics: {total_subtopics}")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_lines))

    print(f"Generated SQL for {total_subtopics} subtopics")
    print(f"Saved to: {output_path}")

if __name__ == "__main__":
    json_path = r"C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents\batch_caps_results_v5.json"
    output_path = r"C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents\import_subtopics.sql"

    generate_subtopic_sql(json_path, output_path)
