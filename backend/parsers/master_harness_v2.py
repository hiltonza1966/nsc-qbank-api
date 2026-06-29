#!/usr/bin/env python3
"""Master Harness v2.2 - Fixed for all 75 papers.
Combines 4 parsers with QP marks as PRIMARY.

FIXES (v2.2):
1. Fixed section totals validation - include main question marks
2. Better variance calculation
3. More accurate confidence scoring
"""

import os
import sys
import json
import re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from qp_content_parser import extract_qp_content
from memo_content_parser import extract_memo_content
from qp_marks_parser import extract_qp_marks
from memo_marks_parser import extract_memo_marks


def _detect_headers(items):
    """Detect header questions and link sub-items."""
    item_map = {item['question_number']: item for item in items}

    header_candidates = []
    for item in items:
        q_num = item['question_number']
        if not re.match(r'^\d+\.\d+$', q_num):
            continue

        has_sub_items = False
        sub_items = []
        for other in items:
            other_q = other['question_number']
            if other_q.startswith(q_num + '.') and other_q != q_num:
                has_sub_items = True
                sub_items.append(other)

        if not has_sub_items:
            continue

        header_candidates.append({
            'question_number': q_num,
            'item': item,
            'sub_items': sub_items
        })

    header_map = {}
    for header in header_candidates:
        q_num = header['question_number']
        item = header['item']
        sub_items = header['sub_items']

        header_marks = sum(s.get('final_marks', 0) for s in sub_items)

        item['is_header'] = 1
        item['header_marks'] = header_marks

        if header_marks > 0:
            item['final_marks'] = header_marks
        item['qp_marks'] = 0

        header_map[q_num] = {
            'marks': header_marks,
            'sub_items': [s['question_number'] for s in sub_items]
        }

        for sub in sub_items:
            sub['parent_header_q'] = q_num
            sub['is_sub_part'] = 1

    return items, header_map


def _validate_section_totals(items, section_totals):
    """Validate that sum of inline marks matches section total."""
    main_questions = {}
    for item in items:
        q_num = item['question_number']
        main_q = q_num.split('.')[0]
        if main_q not in main_questions:
            main_questions[main_q] = []
        main_questions[main_q].append(item)

    for main_q, total in section_totals.items():
        if main_q not in main_questions:
            continue

        section_items = main_questions[main_q]
        # v2.2 FIX: Sum ALL marks in section (including main question and sub-items)
        # Exclude headers since their marks are sums of sub-items
        inline_sum = sum(i.get('final_marks', 0) for i in section_items
                        if not i.get('is_header'))

        header_items = [i for i in section_items if i.get('is_header')]
        header_sum = sum(i.get('header_marks', 0) for i in header_items)

        total_calculated = inline_sum + header_sum
        variance = total - total_calculated

        if abs(variance) > 0:
            for item in section_items:
                if item.get('confidence') == 'green':
                    item['confidence'] = 'yellow'
                    if item.get('issue'):
                        item['issue'] += f"; Section total variance: {variance}"
                    else:
                        item['issue'] = f"Section total variance: {variance}"

    return items


def _create_main_question_items(items, section_totals):
    """Create items for main questions from section totals."""
    existing_q_nums = {item['question_number'] for item in items}
    new_items = []

    for main_q, total in section_totals.items():
        if main_q in existing_q_nums:
            continue

        item = {
            'question_number': main_q,
            'question_text': f'QUESTION {main_q}',
            'answer_text': '',
            'qp_marks': total,
            'memo_section_marks': total,
            'final_marks': total,
            'confidence': 'green',
            'issue': '',
            'qp_images': [],
            'memo_images': [],
            'qp_tables': [],
            'memo_tables': [],
            'qp_pages': [],
            'memo_pages': [],
            'has_visual_content': False,
            'is_header': 0,
            'is_sub_part': 0,
            'parent_header_q': None
        }
        new_items.append(item)

    return items + new_items


def run_harness_v2(qp_path, memo_path, paper_code, output_dir=None):
    """Run complete four-parser chain and return combined results."""
    print(f"=== HARNESS v2.2: {paper_code} ===")

    qp_img_dir = None
    memo_img_dir = None
    if output_dir:
        qp_img_dir = os.path.join(output_dir, 'qp_images')
        memo_img_dir = os.path.join(output_dir, 'memo_images')
        os.makedirs(qp_img_dir, exist_ok=True)
        os.makedirs(memo_img_dir, exist_ok=True)

    print("\n[1/5] QP Content Parser...")
    qp_content_items = extract_qp_content(qp_path, qp_img_dir)
    print(f"  QP content items: {len(qp_content_items)}")

    print("\n[2/5] Memo Content Parser...")
    memo_content_items = extract_memo_content(memo_path, memo_img_dir)
    print(f"  Memo content items: {len(memo_content_items)}")

    print("\n[3/5] QP Marks Parser (PRIMARY)...")
    qp_marks_items = extract_qp_marks(qp_path)
    print(f"  QP marks items: {len(qp_marks_items)}")

    print("\n[4/5] Memo Marks Parser (VALIDATION)...")
    memo_marks_items = extract_memo_marks(memo_path)
    print(f"  Memo marks items: {len(memo_marks_items)}")

    print("\n[5/5] Combining all parsers...")

    qp_content_dict = {item['question_number']: item for item in qp_content_items}
    memo_content_dict = {item['question_number']: item for item in memo_content_items}
    qp_marks_dict = {item['question_number']: item['marks'] for item in qp_marks_items}
    memo_marks_dict = {item['question_number']: item['marks'] for item in memo_marks_items}

    section_totals = {}
    for item in qp_marks_items:
        if item['source'] == 'qp_allocation_table':
            section_totals[item['question_number']] = item['marks']

    all_q_nums = set(qp_content_dict.keys()) | set(memo_content_dict.keys())

    # INFER MISSING MARKS FROM SECTION TOTALS
    for main_q, total in section_totals.items():
        sub_qs = [q for q in all_q_nums if q.startswith(main_q + '.')]
        if not sub_qs:
            continue

        found_sum = sum(qp_marks_dict.get(q, 0) for q in sub_qs)
        remaining = total - found_sum

        missing_qs = [q for q in sub_qs if qp_marks_dict.get(q, 0) == 0]

        if remaining > 0 and missing_qs:
            per_q = remaining // len(missing_qs)
            remainder = remaining % len(missing_qs)

            for i, q in enumerate(missing_qs):
                allocated = per_q + (1 if i < remainder else 0)
                if allocated > 0:
                    qp_marks_dict[q] = allocated

    matched = []
    qp_only = []
    memo_only = []

    for q_num in sorted(all_q_nums, key=lambda x: [int(n) for n in x.split('.')]):
        qp_content = qp_content_dict.get(q_num)
        memo_content = memo_content_dict.get(q_num)
        qp_marks = qp_marks_dict.get(q_num, 0)
        memo_section_marks = memo_marks_dict.get(q_num.split('.')[0], 0)

        final_marks = qp_marks

        if final_marks == 0 and '.' not in q_num:
            final_marks = section_totals.get(q_num, 0)

        main_q = q_num.split('.')[0]
        is_main_question = ('.' not in q_num)

        if is_main_question:
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
            if qp_marks > 0:
                confidence = 'green'
            elif final_marks > 0:
                confidence = 'yellow'
            else:
                confidence = 'red'

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
            'has_visual_content': (qp_content.get('has_visual_content', False) if qp_content else False) or
                                 (memo_content.get('has_visual_content', False) if memo_content else False),
            'is_header': 0,
            'is_sub_part': 0,
            'parent_header_q': None
        }

        if qp_content and memo_content:
            matched.append(item)
        elif qp_content and not memo_content:
            qp_only.append(item)
        elif memo_content and not qp_content:
            memo_only.append(item)

    all_items = matched + qp_only + memo_only
    all_items, header_map = _detect_headers(all_items)

    all_items = _create_main_question_items(all_items, section_totals)

    all_items = _validate_section_totals(all_items, section_totals)

    matched = [i for i in all_items if i['question_text'] and i['answer_text']]
    qp_only = [i for i in all_items if i['question_text'] and not i['answer_text']]
    memo_only = [i for i in all_items if not i['question_text'] and i['answer_text']]

    green = [m for m in matched if m['confidence'] == 'green']
    yellow = [m for m in matched if m['confidence'] == 'yellow']
    red = [m for m in matched if m['confidence'] == 'red']

    total_marks = sum(m['final_marks'] for m in matched)
    target_marks = sum(section_totals.values()) if section_totals else 150

    print(f"\n=== Results ===")
    print(f"  Matched: {len(matched)} | QP Only: {len(qp_only)} | Memo Only: {len(memo_only)}")
    print(f"  Green: {len(green)} | Yellow: {len(yellow)} | Red: {len(red)}")
    print(f"  Headers detected: {len(header_map)}")
    print(f"  Total marks: {total_marks} (target: {target_marks})")
    print(f"  Variance: {target_marks - total_marks}")

    return {
        'status': 'success',
        'paper_code': paper_code,
        'parser_version': 'v32',
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
        'section_totals': section_totals,
        'header_map': header_map
    }


if __name__ == '__main__':
    if len(sys.argv) >= 3:
        result = run_harness_v2(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'TEST')
        print("\n=== FINAL OUTPUT ===")
        print(json.dumps(result, indent=2))
