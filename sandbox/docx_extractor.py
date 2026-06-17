#!/usr/bin/env python3
"""DOCX Question Paper Extractor - Extracts items from DOCX format QP files."""

import re
import docx

def extract_qp_items_from_docx(docx_path):
    """
    Extract question items from DOCX question paper.
    DBE DOCX papers use tables where:
    - Column 1 or 2: Question number (e.g., 1.1.1, 3.2)
    - Middle columns: Question text
    - Last column: Marks in parentheses (e.g., (2))
    Returns list of dicts with question_number, question_text, marks.
    """
    doc = docx.Document(docx_path)
    raw_items = []

    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            if not any(c for c in cells if c):
                continue

            q_num = None
            q_text = None
            marks = 0

            # Find question number in any cell
            for cell in cells:
                m = re.search(r'\b(\d+\.\d+(?:\.\d+)?)\b', cell)
                if m and not q_num:
                    q_num = m.group(1)

            # Find marks - look for (N) in cells that are NOT the question text
            for cell in cells:
                cell_clean = cell.strip()
                # Skip if cell is just the question number
                if re.match(r'^\d+\.\d+(?:\.\d+)?\s*$', cell_clean):
                    continue
                # Look for marks pattern (N) - but not if it's part of a larger text
                m = re.search(r'^\((\d+)\)\s*$', cell_clean)
                if m:
                    marks = int(m.group(1))
                # Also check for [N] section totals - skip these
                if re.match(r'^\[\d+\]\s*$', cell_clean):
                    marks = 0  # Don't use section totals as item marks

            # Find question text - longest meaningful cell
            for cell in cells:
                cell_clean = cell.strip()
                if not cell_clean or len(cell_clean) < 3:
                    continue
                if re.match(r'^\d+\.\d+(?:\.\d+)?\s*$', cell_clean):
                    continue
                if re.match(r'^\(\d+\)\s*$', cell_clean):
                    continue
                if re.match(r'^\[\d+\]\s*$', cell_clean):
                    continue
                if re.match(r'^\d+\.\s*$', cell_clean):
                    continue
                if any(x in cell_clean.lower() for x in [
                    'instructions', 'information', 'answer all', 
                    'this question', 'write your centre', 'number the answers',
                    'question', 'number', 'marks'
                ]):
                    continue

                q_text = cell_clean
                break

            if q_num and q_text:
                raw_items.append({
                    'question_number': q_num,
                    'question_text': q_text,
                    'marks': marks,
                    'depth': q_num.count('.')
                })

    # NEW FIX: Identify parent headers (X.Y that have X.Y.Z children) across ALL items
    parents = set()
    for item in raw_items:
        if item['depth'] == 1:  # X.Y format
            parent_num = item['question_number']
            has_children = any(
                i['question_number'].startswith(parent_num + '.') 
                for i in raw_items
            )
            if has_children:
                parents.add(parent_num)

    # NEW FIX: Also identify parents with 0 marks that have children with marks
    # These are definitely parent headers
    for item in raw_items:
        if item['depth'] == 1 and item['marks'] == 0:
            parent_num = item['question_number']
            children_with_marks = any(
                i['question_number'].startswith(parent_num + '.') and i['marks'] > 0
                for i in raw_items
            )
            if children_with_marks:
                parents.add(parent_num)

    # Filter: keep only leaf items (non-parents)
    items = [item for item in raw_items if item['question_number'] not in parents]

    # Deduplicate by question number (keep first occurrence with highest marks)
    best_items = {}
    for item in items:
        qn = item['question_number']
        if qn not in best_items:
            best_items[qn] = item
        else:
            existing = best_items[qn]
            if item['marks'] > existing['marks']:
                best_items[qn] = item
            elif item['marks'] == existing['marks'] and len(item['question_text']) > len(existing['question_text']):
                best_items[qn] = item

    result = []
    for qn in sorted(best_items.keys(), key=lambda x: [int(n) for n in x.split('.')]):
        item = best_items[qn]
        result.append({
            'question_number': item['question_number'],
            'question_text': item['question_text'],
            'marks': item['marks'],
            'source': 'qp',
            'format': 'docx'
        })

    return result


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        items = extract_qp_items_from_docx(sys.argv[1])
        print(f"Found {len(items)} items")
        for item in items[:10]:
            print(f"  Q{item['question_number']}: {item['marks']} marks - {item['question_text'][:50]}")
        total = sum(i['marks'] for i in items)
        print(f"Total marks: {total}")
