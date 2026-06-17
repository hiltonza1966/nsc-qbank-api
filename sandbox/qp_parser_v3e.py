#!/usr/bin/env python3
"""QP Parser v3d - Refined with better text extraction and mark parsing"""
import re
from PyPDF2 import PdfReader

def extract_qp_items_v3d(pdf_path):
    reader = PdfReader(pdf_path)

    page_texts = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            page_texts.append(text)

    # Parse section headers for mark allocations
    section_marks = {}
    all_text = "\n".join(page_texts)

    # Find section headers: "1.1 Match... (8 x 1)"
    section_pattern = r'(\d+\.\d+)\s+.*?\s+\((\d+)\s*x\s*(\d+)\)'
    for match in re.finditer(section_pattern, all_text):
        section_num = match.group(1)
        count = int(match.group(2))
        marks_per = int(match.group(3))
        section_marks[section_num] = {
            'count': count,
            'marks_per': marks_per,
            'total': count * marks_per
        }

    # Find individual question marks: "1.3.1 Define... (1 x 2)"
    individual_pattern = r'(\d+\.\d+\.\d+)\s+.*?\s+\((\d+)\s*x\s*(\d+)\)'
    for match in re.finditer(individual_pattern, all_text):
        q_num = match.group(1)
        count = int(match.group(2))
        marks_per = int(match.group(3))
        section_marks[q_num] = {
            'count': count,
            'marks_per': marks_per,
            'total': count * marks_per,
            'is_individual': True
        }

    # Extract question items
    items = []
    q_pattern = r'(\d+\.\d+\.\d+)\s+(.*?)(?=\d+\.\d+\.\d+|\Z)'

    for page_text in page_texts:
        matches = list(re.finditer(q_pattern, page_text, re.DOTALL))
        for match in matches:
            q_num = match.group(1)
            q_text = match.group(2).strip()

            # Clean text - remove artifacts
            q_text = re.sub(r'\s+', ' ', q_text)
            q_text = re.sub(r'\(\d+\s*x\s*\d+\).*', '', q_text)
            q_text = re.sub(r'\(\d+\).*', '', q_text)
            q_text = re.sub(r'Please turn over', '', q_text)
            q_text = re.sub(r'Copyright reserved', '', q_text)
            q_text = q_text.replace('Nov', '').replace('COLUMN A', '').replace('COLUMN B', '').strip()

            # Skip 2-part numbers (parent headers)
            if len(q_num.split('.')) != 3:
                continue

            # Determine marks
            marks = 0
            parent = '.'.join(q_num.split('.')[:2])

            if q_num in section_marks:
                marks = section_marks[q_num]['marks_per']
            elif parent in section_marks:
                marks = section_marks[parent]['marks_per']

            # Check for paragraph questions
            is_paragraph = any(x in q_text.lower() for x in ['paragraph', 'essay', 'in a paragraph'])
            if is_paragraph and marks == 0:
                # Try to find paragraph marks in parent section
                if parent in section_marks:
                    marks = section_marks[parent]['total']

            if len(q_text) > 5:
                items.append({
                    'question_number': q_num,
                    'question_text': q_text[:300],
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
