#!/usr/bin/env python3
"""Master Harness v2 - Combines 4 parsers with QP marks as PRIMARY.

Architecture:
- Parser 1 (qp_content): question text + attachments
- Parser 2 (memo_content): answer text + attachments  
- Parser 3 (qp_marks): marks from QP (PRIMARY)
- Parser 4 (memo_marks): section totals from Memo (VALIDATION)
- Harness: combines by question_number, validates totals
"""

import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from qp_content_parser import extract_qp_content
from memo_content_parser import extract_memo_content
from qp_marks_parser import extract_qp_marks
from memo_marks_parser import extract_memo_marks


def run_harness_v2(qp_path, memo_path, paper_code, output_dir=None):
    """Run complete four-parser chain and return combined results."""
    print(f"=== HARNESS v2: {paper_code} ===")

    qp_img_dir = None
    memo_img_dir = None
    if output_dir:
        qp_img_dir = os.path.join(output_dir, 'qp_images')
        memo_img_dir = os.path.join(output_dir, 'memo_images')
        os.makedirs(qp_img_dir, exist_ok=True)
        os.makedirs(memo_img_dir, exist_ok=True)

    # === PARSER 1: QP Content ===
    print("\n[1/5] QP Content Parser...")
    qp_content_items = extract_qp_content(qp_path, qp_img_dir)
    print(f"  QP content items: {len(qp_content_items)}")

    # === PARSER 2: Memo Content ===
    print("\n[2/5] Memo Content Parser...")
    memo_content_items = extract_memo_content(memo_path, memo_img_dir)
    print(f"  Memo content items: {len(memo_content_items)}")

    # === PARSER 3: QP Marks (PRIMARY) ===
    print("\n[3/5] QP Marks Parser (PRIMARY)...")
    qp_marks_items = extract_qp_marks(qp_path)
    print(f"  QP marks items: {len(qp_marks_items)}")
    for item in qp_marks_items[:10]:
        print(f"    {item['question_number']}: {item['marks']} marks ({item['source']})")

    # === PARSER 4: Memo Marks (VALIDATION) ===
    print("\n[4/5] Memo Marks Parser (VALIDATION)...")
    memo_marks_items = extract_memo_marks(memo_path)
    print(f"  Memo marks items: {len(memo_marks_items)}")
    for item in memo_marks_items:
        print(f"    {item['question_number']}: {item['marks']} marks ({item['source']})")

    # === COMBINER ===
    print("\n[5/5] Combining all parsers...")

    qp_content_dict = {item['question_number']: item for item in qp_content_items}
    memo_content_dict = {item['question_number']: item for item in memo_content_items}
    qp_marks_dict = {item['question_number']: item['marks'] for item in qp_marks_items}
    memo_marks_dict = {item['question_number']: item['marks'] for item in memo_marks_items}

    # Get section totals from QP allocation table
    section_totals = {}
    for item in qp_marks_items:
        if item['source'] == 'qp_allocation_table':
            section_totals[item['question_number']] = item['marks']

    # (Inference will run after all_q_nums is defined)

    # Get all unique question numbers from content parsers
    all_q_nums = set(qp_content_dict.keys()) | set(memo_content_dict.keys())

    # === INFER MISSING MARKS FROM SECTION TOTALS ===
    # For each main question, if sum of sub-question marks < section total,
    # distribute remaining marks among missing sub-questions
    for main_q, total in section_totals.items():
        # Find all sub-questions for this main question
        sub_qs = [q for q in all_q_nums if q.startswith(main_q + '.')]
        if not sub_qs:
            continue

        # Calculate sum of found marks
        found_sum = sum(qp_marks_dict.get(q, 0) for q in sub_qs)
        remaining = total - found_sum

        # Find sub-questions with no marks
        missing_qs = [q for q in sub_qs if qp_marks_dict.get(q, 0) == 0]

        if remaining > 0 and missing_qs:
            # Distribute remaining marks evenly
            per_q = remaining // len(missing_qs)
            remainder = remaining % len(missing_qs)

            for i, q in enumerate(missing_qs):
                allocated = per_q + (1 if i < remainder else 0)
                if allocated > 0:
                    qp_marks_dict[q] = allocated
                    print(f"  Inferred: {q} = {allocated} marks (from Q{main_q} total {total})")

    matched = []
    qp_only = []
    memo_only = []

    for q_num in sorted(all_q_nums, key=lambda x: [int(n) for n in x.split('.')]):
        qp_content = qp_content_dict.get(q_num)
        memo_content = memo_content_dict.get(q_num)
        qp_marks = qp_marks_dict.get(q_num, 0)
        memo_section_marks = memo_marks_dict.get(q_num.split('.')[0], 0)

        # Determine final marks
        final_marks = qp_marks

        # If no QP marks but we have a section total, check if this is a main question
        if final_marks == 0 and '.' not in q_num:
            final_marks = section_totals.get(q_num, 0)

        # Determine confidence
        main_q = q_num.split('.')[0]
        section_total = section_totals.get(main_q, 0)
        is_main_question = ('.' not in q_num)

        if is_main_question:
            # For main questions (e.g., "1", "2"), compare with memo section total
            if qp_marks > 0 and memo_section_marks > 0:
                if abs(qp_marks - memo_section_marks) <= 2:
                    confidence = 'green'
                else:
                    confidence = 'yellow'
            elif qp_marks > 0:
                confidence = 'yellow'
            elif memo_section_marks > 0:
                confidence = 'yellow'
            else:
                confidence = 'red'
        else:
            # For sub-questions (e.g., "1.1", "2.3"), QP marks are primary
            if qp_marks > 0:
                confidence = 'green'
            elif final_marks > 0:
                confidence = 'yellow'
            else:
                confidence = 'red'

        # Build issue description
        issues = []
        if is_main_question:
            if qp_marks > 0 and memo_section_marks > 0 and abs(qp_marks - memo_section_marks) > 2:
                issues.append(f"QP total ({qp_marks}) differs from Memo total ({memo_section_marks})")
            elif qp_marks == 0 and memo_section_marks == 0:
                issues.append("No section total found")
        else:
            if qp_marks == 0 and final_marks > 0:
                issues.append("Using section total - no inline mark found")
            if qp_marks == 0 and final_marks == 0:
                issues.append("No marks found")
            if final_marks > 30:
                issues.append("High marks - verify not section total")

        issue = '; '.join(issues) if issues else ''

        item = {
            'question_number': q_num,
            'question_text': qp_content['question_text'] if qp_content else '',
            'answer_text': memo_content['answer_text'] if memo_content else '',
            'qp_marks': qp_marks,
            'memo_section_marks': memo_section_marks,
            'final_marks': final_marks,
            'confidence': confidence,
            'issue': issue,
            'qp_images': qp_content.get('images', []) if qp_content else [],
            'memo_images': memo_content.get('images', []) if memo_content else [],
            'qp_tables': qp_content.get('tables', []) if qp_content else [],
            'memo_tables': memo_content.get('tables', []) if memo_content else [],
            'qp_pages': qp_content.get('page_numbers', []) if qp_content else [],
            'memo_pages': memo_content.get('page_numbers', []) if memo_content else [],
            'has_visual_content': (qp_content.get('has_visual_content', False) if qp_content else False) or \
                                 (memo_content.get('has_visual_content', False) if memo_content else False)
        }

        if qp_content and memo_content:
            matched.append(item)
        elif qp_content and not memo_content:
            qp_only.append(item)
        elif memo_content and not qp_content:
            memo_only.append(item)

    # Calculate totals and confidence distribution
    green = [m for m in matched if m['confidence'] == 'green']
    yellow = [m for m in matched if m['confidence'] == 'yellow']
    red = [m for m in matched if m['confidence'] == 'red']

    total_marks = sum(m['final_marks'] for m in matched)
    target_marks = sum(section_totals.values()) if section_totals else 150

    print(f"\n=== Results ===")
    print(f"  Matched: {len(matched)} | QP Only: {len(qp_only)} | Memo Only: {len(memo_only)}")
    print(f"  Green: {len(green)} | Yellow: {len(yellow)} | Red: {len(red)}")
    print(f"  Total marks: {total_marks} (target: {target_marks})")
    print(f"  Variance: {target_marks - total_marks}")

    result = {
        'status': 'success',
        'paper_code': paper_code,
        'parser_version': 'v30',
        'matched': len(matched),
        'qp_only': len(qp_only),
        'memo_only': len(memo_only),
        'total_marks': total_marks,
        'target_marks': target_marks,
        'variance': target_marks - total_marks,
        'green_count': len(green),
        'yellow_count': len(yellow),
        'red_count': len(red),
        'green_items': green,
        'yellow_items': yellow,
        'red_items': red,
        'qp_only_items': qp_only,
        'memo_only_items': memo_only,
        'section_totals': section_totals
    }

    return result


if __name__ == '__main__':
    if len(sys.argv) >= 3:
        result = run_harness_v2(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'TEST')
        print("\n=== FINAL OUTPUT ===")
        print(json.dumps(result, indent=2))
