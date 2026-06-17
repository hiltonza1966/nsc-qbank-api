#!/usr/bin/env python3
"""Master Test Harness for QBank Parser System.
STRATEGY: Use QP marks as PRIMARY, memo marks as verification/fallback.
Detects target marks from paper header (MARKS: X).
"""

import json
import sys
import os
import re
from PyPDF2 import PdfReader
from unified_qp_parser import extract_qp_items, detect_format
from memo_parser_option_b import extract_memo_items_option_b

def detect_target_marks(qp_path):
    """Detect target marks from paper header (e.g., 'MARKS: 75' or 'MARKS: 150')."""
    try:
        if qp_path.endswith('.pdf'):
            reader = PdfReader(qp_path)
            text = ""
            for page in reader.pages[:2]:  # Check first 2 pages
                text += page.extract_text() or ""
        elif qp_path.endswith('.docx'):
            import docx
            doc = docx.Document(qp_path)
            text = "\n".join([p.text for p in doc.paragraphs[:20]])
        else:
            return 150  # Default

        # Look for MARKS: X pattern
        match = re.search(r'MARKS:\s*(\d+)', text, re.IGNORECASE)
        if match:
            return int(match.group(1))

        # Alternative patterns
        match = re.search(r'Total:\s*(\d+)\s*marks', text, re.IGNORECASE)
        if match:
            return int(match.group(1))

        match = re.search(r'\[\s*(\d+)\s*\]', text)
        if match:
            return int(match.group(1))

        return 150  # Default fallback
    except Exception:
        return 150

def find_memo_sub_items(memo_dict, parent_num):
    """Find all memo items that are children of parent_num (e.g., 3.5 -> 3.5.1, 3.5.2)."""
    sub_items = []
    for q_num, item in memo_dict.items():
        if q_num.startswith(parent_num + '.'):
            sub_items.append(item)
    return sub_items

def run_harness(qp_path, memo_path, paper_code):
    """Run complete parser test on a QP + Memo pair."""
    print(f"=== HARNESS: {paper_code} ===")

    qp_ext = os.path.splitext(qp_path)[1].lower()
    memo_ext = os.path.splitext(memo_path)[1].lower()
    print(f"QP format: {qp_ext}, Memo format: {memo_ext}")

    # Detect target marks
    target_marks = detect_target_marks(qp_path)
    print(f"Target marks: {target_marks}")

    print("\n[1/4] Running QP Parser...")
    qp_items = extract_qp_items(qp_path)
    print(f"  QP items: {len(qp_items)}")
    if qp_items:
        print(f"  Sample: {qp_items[0]['question_number']} - {qp_items[0]['marks']} marks")

    print("\n[2/4] Running Memo Parser...")
    if memo_ext == '.pdf':
        memo_items = extract_memo_items_option_b(memo_path)
    else:
        print("  ERROR: Memo must be PDF (bilingual)")
        memo_items = []
    print(f"  Memo items: {len(memo_items)}")
    if memo_items:
        print(f"  Sample: {memo_items[0]['question_number']} - {memo_items[0]['marks']} marks")

    print("\n[3/4] Running Matcher...")
    qp_dict = {item['question_number']: item for item in qp_items}
    memo_dict = {item['question_number']: item for item in memo_items}

    matched = []
    qp_only = []
    memo_only = []

    # First pass: direct matches
    for q_num in sorted(qp_dict.keys(), key=lambda x: [int(n) for n in x.split('.')]):
        qp_item = qp_dict[q_num]

        if q_num in memo_dict:
            # Direct match
            memo_item = memo_dict[q_num]

            # STRATEGY: Determine final marks
            qp_marks = qp_item['marks']
            memo_marks = memo_item['marks']

            # If memo marks are 0 or very different from QP, use QP marks
            if memo_marks == 0:
                final_marks = qp_marks
            elif qp_marks > 0 and abs(qp_marks - memo_marks) > 2:
                # Large mismatch - use QP marks as primary
                final_marks = qp_marks
            else:
                # Close match or QP has 0 marks - use memo marks
                final_marks = memo_marks if memo_marks > 0 else qp_marks

            matched.append({
                'question_number': q_num,
                'question_text': qp_item['question_text'],
                'answer_text': memo_item['answer_text'],
                'qp_marks': qp_marks,
                'memo_marks': memo_marks,
                'final_marks': final_marks,
                'status': 'matched'
            })
        else:
            # Check if memo has sub-items (e.g., QP has 3.5, memo has 3.5.1, 3.5.2)
            sub_items = find_memo_sub_items(memo_dict, q_num)
            if sub_items:
                # Sum sub-marks
                total_memo_marks = sum(item['marks'] for item in sub_items)
                combined_answer = ' | '.join(item['answer_text'] for item in sub_items)

                # STRATEGY: Use QP marks if memo sub-marks are 0 or very different
                qp_marks = qp_item['marks']
                if total_memo_marks == 0 or (qp_marks > 0 and abs(qp_marks - total_memo_marks) > 2):
                    final_marks = qp_marks
                else:
                    final_marks = total_memo_marks if total_memo_marks > 0 else qp_marks

                matched.append({
                    'question_number': q_num,
                    'question_text': qp_item['question_text'],
                    'answer_text': combined_answer,
                    'qp_marks': qp_marks,
                    'memo_marks': total_memo_marks,
                    'final_marks': final_marks,
                    'status': 'matched'
                })
            else:
                # No match at all
                qp_only.append({
                    'question_number': q_num,
                    'question_text': qp_item['question_text'],
                    'qp_marks': qp_item['marks'],
                    'final_marks': qp_item['marks'],
                    'status': 'qp_only'
                })

    # Find memo-only items (not matched and not sub-items of matched QP items)
    matched_qp_nums = set(qp_dict.keys())
    for q_num in sorted(memo_dict.keys(), key=lambda x: [int(n) for n in x.split('.')]):
        if q_num not in matched_qp_nums:
            # Check if this is a sub-item of a matched QP item
            parent_found = False
            for qp_num in matched_qp_nums:
                if q_num.startswith(qp_num + '.'):
                    parent_found = True
                    break
            if not parent_found:
                memo_only.append({
                    'question_number': q_num,
                    'answer_text': memo_dict[q_num]['answer_text'],
                    'memo_marks': memo_dict[q_num]['marks'],
                    'final_marks': memo_dict[q_num]['marks'],
                    'status': 'memo_only'
                })

    print(f"  Matched: {len(matched)}")
    print(f"  QP only: {len(qp_only)}")
    print(f"  Memo only: {len(memo_only)}")

    print("\n[4/4] Generating Review Flags...")
    green = []
    yellow = []
    red = []

    all_items = matched + qp_only + memo_only

    for item in all_items:
        final_marks = item['final_marks']
        qp_marks = item.get('qp_marks', 0)
        memo_marks = item.get('memo_marks', 0)
        answer_text = item.get('answer_text', '')
        question_text = item.get('question_text', '')

        # Red only if BOTH QP and memo have 0 marks
        if final_marks == 0 and qp_marks == 0 and memo_marks == 0:
            red.append({**item, 'issue': 'No marks found in QP or memo', 'confidence': 'red', 'review_action': 'Add marks manually'})
        # Yellow if there's a significant mismatch (but we already used QP marks, so this is info only)
        elif qp_marks > 0 and memo_marks > 0 and abs(qp_marks - memo_marks) > 2:
            yellow.append({**item, 'issue': f'Mark mismatch: QP={qp_marks}, Memo={memo_marks} (using QP={final_marks})', 'confidence': 'yellow', 'review_action': 'Verify correct marks'})
        elif len(answer_text) < 5 and final_marks > 2:
            yellow.append({**item, 'issue': f'Short answer ({len(answer_text)} chars) for {final_marks} marks', 'confidence': 'yellow', 'review_action': 'Verify answer completeness'})
        elif final_marks >= 6 and not any(x in (question_text + answer_text).lower() for x in ['paragraph', 'essay', 'discuss', 'explain', 'suggest', 'describe', 'calculate', 'determine', 'prove']):
            yellow.append({**item, 'issue': f'High marks ({final_marks}) - verify not section total', 'confidence': 'yellow', 'review_action': 'Verify mark allocation'})
        else:
            green.append({**item, 'confidence': 'green', 'review_action': 'None - auto-approve'})

    print(f"  Green: {len(green)}")
    print(f"  Yellow: {len(yellow)}")
    print(f"  Red: {len(red)}")

    total_marks = sum(item['final_marks'] for item in matched)
    total_marks += sum(item['final_marks'] for item in qp_only)
    total_marks += sum(item['final_marks'] for item in memo_only)

    result = {
        'paper_code': paper_code,
        'qp_items': len(qp_items),
        'memo_items': len(memo_items),
        'matched': len(matched),
        'qp_only': len(qp_only),
        'memo_only': len(memo_only),
        'total_marks': total_marks,
        'target_marks': target_marks,
        'variance': target_marks - total_marks,
        'green_count': len(green),
        'yellow_count': len(yellow),
        'red_count': len(red),
        'red_items': [{'q': r['question_number'], 'issue': r['issue']} for r in red[:10]],
        'yellow_items': [{'q': y['question_number'], 'issue': y['issue']} for y in yellow[:10]],
        'green_items': [{'q': g['question_number']} for g in green[:5]],
    }

    print(f"\n{'='*60}")
    print(f"RESULTS for {paper_code}:")
    print(f"  Total marks: {total_marks} (target: {target_marks})")
    print(f"  Variance: {result['variance']}")
    print(f"  Green: {len(green)} | Yellow: {len(yellow)} | Red: {len(red)}")
    print(f"{'='*60}")

    return result

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python master_harness.py <qp_file> <memo_file> <paper_code>")
        print("Example: python master_harness.py TechSci_P1_QP.pdf TechSci_P1_Memo.pdf TECH_SCI_P1_NOV_2024")
        sys.exit(1)

    qp_path = sys.argv[1]
    memo_path = sys.argv[2]
    paper_code = sys.argv[3]

    result = run_harness(qp_path, memo_path, paper_code)

    output_file = f"parser_result_{paper_code}.json"
    with open(output_file, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"\nResults saved to: {output_file}")
