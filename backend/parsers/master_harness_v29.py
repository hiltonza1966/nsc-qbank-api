#!/usr/bin/env python3
"""Enhanced Master Harness - Combines QP and Memo with full content including images and tables."""

import os
import sys
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from unified_qp_parser import extract_qp_items
from memo_parser_option_b import extract_memo_items_option_b


def run_harness_enhanced(qp_path, memo_path, paper_code, output_dir=None):
    """Run complete parser with enhanced output including images and tables."""
    print(f"=== ENHANCED HARNESS: {paper_code} ===")

    # Create output directory for images
    if output_dir:
        qp_img_dir = os.path.join(output_dir, 'qp_images')
        memo_img_dir = os.path.join(output_dir, 'memo_images')
    else:
        qp_img_dir = None
        memo_img_dir = None

    # Extract QP items
    print("\n[1/4] Running QP Parser...")
    qp_items = extract_qp_items(qp_path)
    print(f"  QP items: {len(qp_items)}")
    if qp_items:
        print(f"  Sample: {qp_items[0]['question_number']} - {qp_items[0]['marks']} marks")
        print(f"  Text: {qp_items[0]['question_text'][:60]}...")

    # Extract Memo items
    print("\n[2/4] Running Memo Parser...")
    memo_items = extract_memo_items_option_b(memo_path)
    print(f"  Memo items: {len(memo_items)}")
    if memo_items:
        print(f"  Sample: {memo_items[0]['question_number']} - {memo_items[0]['marks']} marks")
        print(f"  Text: {memo_items[0]['answer_text'][:60]}...")

    # Match items
    print("\n[3/4] Running Matcher...")
    qp_dict = {item['question_number']: item for item in qp_items}
    memo_dict = {item['question_number']: item for item in memo_items}

    matched = []
    qp_only = []
    memo_only = []

    for q_num in sorted(qp_dict.keys(), key=lambda x: [int(n) for n in x.split('.')]):
        qp_item = qp_dict[q_num]

        if q_num in memo_dict:
            memo_item = memo_dict[q_num]

            # Determine final marks
            qp_marks = qp_item['marks']
            memo_marks = memo_item['marks']

            if memo_marks == 0:
                final_marks = qp_marks
            elif qp_marks > 0 and abs(qp_marks - memo_marks) > 2:
                final_marks = qp_marks
            else:
                final_marks = memo_marks if memo_marks > 0 else qp_marks

            # Determine confidence level
            variance = abs(qp_marks - memo_marks)
            if variance == 0 and qp_marks > 0:
                confidence = 'green'
            elif variance <= 2:
                confidence = 'yellow'
            else:
                confidence = 'red'

            issue = ''
            if variance > 0:
                issue = f"Mark mismatch: QP={qp_marks}, Memo={memo_marks}"
            if qp_marks > 30:
                issue += "; High marks - verify not section total" if issue else "High marks - verify not section total"

            matched.append({
                'question_number': q_num,
                'question_text': qp_item['question_text'],
                'answer_text': memo_item['answer_text'],
                'qp_marks': qp_marks,
                'memo_marks': memo_marks,
                'final_marks': final_marks,
                'confidence': confidence,
                'issue': issue,
                'qp_images': qp_item.get('images', []),
                'memo_images': memo_item.get('images', []),
                'qp_tables': qp_item.get('tables', []),
                'memo_tables': memo_item.get('tables', []),
                'qp_pages': qp_item.get('page_numbers', []),
                'memo_pages': memo_item.get('page_numbers', []),
                'has_visual_content': qp_item.get('has_visual_content', False) or memo_item.get('has_visual_content', False)
            })
        else:
            qp_only.append(qp_item)

    for q_num in memo_dict:
        if q_num not in qp_dict:
            memo_only.append(memo_dict[q_num])

    # Calculate totals
    green = [m for m in matched if m['confidence'] == 'green']
    yellow = [m for m in matched if m['confidence'] == 'yellow']
    red = [m for m in matched if m['confidence'] == 'red']

    total_marks = sum(m['final_marks'] for m in matched)
    target_marks = 150  # Should be detected from PDF header

    print(f"\n[4/4] Results:")
    print(f"  Matched: {len(matched)} | QP Only: {len(qp_only)} | Memo Only: {len(memo_only)}")
    print(f"  Green: {len(green)} | Yellow: {len(yellow)} | Red: {len(red)}")
    print(f"  Total marks: {total_marks} (target: {target_marks})")

    result = {
        'status': 'success',
        'paper_code': paper_code,
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
        'memo_only_items': memo_only
    }

    return result


if __name__ == '__main__':
    if len(sys.argv) >= 3:
        result = run_harness_enhanced(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'TEST')
        print("\n=== FINAL OUTPUT ===")
        print(json.dumps(result, indent=2))
