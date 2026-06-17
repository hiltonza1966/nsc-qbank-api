#!/usr/bin/env python3
"""Master Harness v3d - Refined parser pipeline"""
import json
import sys
import os

try:
    from PyPDF2 import PdfReader
except ImportError:
    print("ERROR: PyPDF2 is not installed.")
    print("Please run: python -m pip install PyPDF2")
    sys.exit(1)

try:
    from qp_parser_v3d import extract_qp_items_v3d
    from memo_parser_v3d import extract_memo_items_v3d
    from matcher_v3 import match_items_v3
    from review_generator_v3 import generate_review_v3
except ImportError as e:
    print(f"ERROR: Could not import parser modules: {e}")
    print("Ensure files are renamed to valid Python module names:")
    print("  1_qp_parser_v3d.py -> qp_parser_v3d.py")
    print("  2_memo_parser_v3d.py -> memo_parser_v3d.py")
    print("  3_matcher_v3.py -> matcher_v3.py")
    print("  4_review_generator_v3.py -> review_generator_v3.py")
    sys.exit(1)

def run_harness_v3d(qp_path, memo_path, paper_code):
    print(f"=== MASTER HARNESS v3d for {paper_code} ===")

    if not os.path.exists(qp_path):
        print(f"ERROR: QP file not found: {qp_path}")
        sys.exit(1)
    if not os.path.exists(memo_path):
        print(f"ERROR: Memo file not found: {memo_path}")
        sys.exit(1)

    print("\n[1/4] Running QP Parser v3d...")
    qp_items = extract_qp_items_v3d(qp_path)
    print(f"  QP items: {len(qp_items)}")
    if qp_items:
        print(f"  Sample: {qp_items[0]['question_number']} - marks={qp_items[0]['marks']}")

    print("\n[2/4] Running Memo Parser v3d...")
    memo_items = extract_memo_items_v3d(memo_path)
    print(f"  Memo items: {len(memo_items)}")
    if memo_items:
        print(f"  Sample: {memo_items[0]['question_number']} - marks={memo_items[0]['marks']}")

    print("\n[3/4] Running Matcher v3...")
    matched, qp_only, memo_only = match_items_v3(qp_items, memo_items)
    print(f"  Matched: {len(matched)}")
    print(f"  QP only: {len(qp_only)}")
    print(f"  Memo only: {len(memo_only)}")

    print("\n[4/4] Generating Review Flags...")
    green, yellow, red = generate_review_v3(matched, qp_only, memo_only)
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
        'target_marks': 150,
        'variance': 150 - total_marks,
        'green_count': len(green),
        'yellow_count': len(yellow),
        'red_count': len(red),
        'green_items': [{'q': g['question_number'], 'marks': g['final_marks']} for g in green[:5]],
        'yellow_items': [{'q': y['question_number'], 'issue': y['issue']} for y in yellow[:10]],
        'red_items': [{'q': r['question_number'], 'issue': r['issue']} for r in red[:10]],
        'all_items': [{
            'question_number': m['question_number'],
            'question_text': m.get('question_text', '')[:100],
            'answer_text': m.get('answer_text', '')[:100],
            'final_marks': m['final_marks'],
            'confidence': m.get('confidence', 'unknown')
        } for m in matched]
    }

    print(f"\n{'='*60}")
    print(f"RESULTS:")
    print(f"  Total marks: {total_marks} (target: 150)")
    print(f"  Variance: {result['variance']}")
    print(f"  Green: {len(green)} | Yellow: {len(yellow)} | Red: {len(red)}")
    print(f"{'='*60}")

    return result

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python master_harness_v3d.py <qp_pdf> <memo_pdf> <paper_code>")
        sys.exit(1)

    qp_path = sys.argv[1]
    memo_path = sys.argv[2]
    paper_code = sys.argv[3]

    result = run_harness_v3d(qp_path, memo_path, paper_code)

    output_file = f"parser_result_{paper_code}.json"
    with open(output_file, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"\nResults saved to: {output_file}")
    print("\nJSON OUTPUT:")
    print(json.dumps(result, indent=2))
