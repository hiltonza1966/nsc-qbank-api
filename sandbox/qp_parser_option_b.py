#!/usr/bin/env python3
"""Option B QP Parser - For Accounting/Business Studies-style DBE papers
Handles: X.Y numbering, table-based questions, mark allocations in headers
"""
import re
from PyPDF2 import PdfReader

def extract_qp_items_option_b(pdf_path):
    reader = PdfReader(pdf_path)

    all_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            all_text += text + "\n"

    # Parse mark allocations from section headers
    # Format: "1.1 Calculate... (6)" or "1.2 Prepare... [8]"
    section_marks = {}

    header_pattern = r'(\d+\.\d+)\s+.*?\s+[(\[](\d+)[)\]]'
    for match in re.finditer(header_pattern, all_text):
        section_num = match.group(1)
        marks = int(match.group(2))
        section_marks[section_num] = marks

    # Also check for sub-question marks
    sub_pattern = r'(\d+\.\d+\.\d+)\s+.*?\s+[(\[](\d+)[)\]]'
    for match in re.finditer(sub_pattern, all_text):
        q_num = match.group(1)
        marks = int(match.group(2))
        section_marks[q_num] = marks

    # Extract questions
    items = []

    # Try X.Y.Z first, then X.Y
    q_pattern = r'(\d+\.\d+\.\d+)\s+(.*?)(?=\d+\.\d+\.\d+|\Z)'
    matches = list(re.finditer(q_pattern, all_text, re.DOTALL))

    if len(matches) < 5:
        # Try X.Y pattern
        q_pattern = r'(\d+\.\d+)\s+(.*?)(?=\d+\.\d+|\Z)'
        matches = list(re.finditer(q_pattern, all_text, re.DOTALL))

    for match in matches:
        q_num = match.group(1)
        q_text = match.group(2).strip()

        q_text = re.sub(r'\s+', ' ', q_text)
        q_text = re.sub(r'Please turn over', '', q_text)
        q_text = re.sub(r'Copyright reserved', '', q_text)
        q_text = re.sub(r'\[\d+\]', '', q_text)
        q_text = re.sub(r'\(\d+\)', '', q_text)
        q_text = q_text.strip()

        # Determine marks
        marks = 0
        if q_num in section_marks:
            marks = section_marks[q_num]
        else:
            parent = '.'.join(q_num.split('.')[:2]) if len(q_num.split('.')) == 3 else q_num
            if parent in section_marks:
                marks = section_marks[parent]

        if len(q_text) > 10:
            items.append({
                'question_number': q_num,
                'question_text': q_text[:400],
                'marks': marks,
                'source': 'qp'
            })

    # Deduplicate
    seen = set()
    unique_items = []
    for item in items:
        if item['question_number'] not in seen:
            seen.add(item['question_number'])
            unique_items.append(item)

    return unique_items
