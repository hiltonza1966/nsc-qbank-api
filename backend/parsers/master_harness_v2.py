#!/usr/bin/env python3
"""Master Harness v2 - Combines 4 parsers with QP marks as PRIMARY.

Architecture:
- Parser 1 (qp_content): question text + attachments
- Parser 2 (memo_content): answer text + attachments  
- Parser 3 (qp_marks): marks from QP (PRIMARY)
- Parser 4 (memo_marks): section totals from Memo (VALIDATION)
- Harness: combines by question_number, validates totals

SURGICAL TWEAKS APPLIED:
1. Header detection: X.Y with sub-items X.Y.1, X.Y.2 -> is_header=1
2. Header marks = sum of sub-item marks (not parser-found marks)
3. Section totals validation against inline marks sum
4. parent_header_id linkage for sub-items
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
    """
    Detect header questions and link sub-items.

    A header is an item with question_number X.Y that has sub-items X.Y.1, X.Y.2, etc.

    Key insight: Even if X.Y has marks from the parser, if it has sub-items,
    it's a header. The parser-found marks are likely the section total or
    incorrectly parsed. The true header marks = sum of sub-item marks.

    Returns: (items_with_headers, header_map)
    """
    # Build lookup
    item_map = {item['question_number']: item for item in items}

    # Find all potential headers: X.Y format that has sub-items X.Y.Z
    header_candidates = []
    for item in items:
        q_num = item['question_number']
        # Must be X.Y format (exactly one dot, not X.Y.Z)
        if not re.match(r'^\d+\.\d+$', q_num):
            continue

        # Check if has sub-items (X.Y.1, X.Y.2, etc.)
        has_sub_items = False
        sub_items = []
        for other in items:
            other_q = other['question_number']
            if other_q.startswith(q_num + '.') and other_q != q_num:
                has_sub_items = True
                sub_items.append(other)

        if not has_sub_items:
            continue

        # This is a header if it has sub-items, regardless of marks
        # But we need to distinguish between:
        # - True header: short text, no real answer, marks are section total
        # - Standalone question: has sub-items but also has its own content

        # Check if it's a true header (introductory text, not a full question)
        question_text = item.get('question_text', '')
        answer_text = item.get('answer_text', '')

        # Heuristics for header detection:
        # 1. Short question text (< 100 chars) - likely just a label/intro
        # 2. No answer text - headers don't have answers
        # 3. Question text contains "choose", "complete", "write", "refer" - instructions
        # 4. Sub-items have substantial content

        is_short_text = len(question_text) < 150
        is_empty_answer = not answer_text or len(answer_text.strip()) < 10

        # Check if sub-items have substantial content
        sub_items_have_content = any(
            len(s.get('question_text', '')) > 50 or 
            len(s.get('answer_text', '')) > 50 
            for s in sub_items
        )

        # If it has sub-items with content AND (short text OR empty answer), it's a header
        if sub_items_have_content and (is_short_text or is_empty_answer):
            header_candidates.append({
                'question_number': q_num,
                'item': item,
                'sub_items': sub_items
            })

    # Mark headers and calculate header marks
    header_map = {}  # header_q_num -> {marks, sub_items}

    for header in header_candidates:
        q_num = header['question_number']
        item = header['item']
        sub_items = header['sub_items']

        # Calculate sum of sub-item marks (from final_marks, not qp_marks)
        header_marks = sum(s.get('final_marks', 0) for s in sub_items)

        # Mark as header
        item['is_header'] = 1
        item['header_marks'] = header_marks

        # Update final_marks to sum of sub-items (not parser-found marks)
        # But only if sub-items have marks > 0
        if header_marks > 0:
            item['final_marks'] = header_marks
            item['qp_marks'] = 0  # Headers don't have their own qp marks

        # Store header info for parent_header_id linkage
        header_map[q_num] = {
            'marks': header_marks,
            'sub_items': [s['question_number'] for s in sub_items]
        }

        # Mark sub-items with parent_header_q reference
        for sub in sub_items:
            sub['parent_header_q'] = q_num

    return items, header_map


def _validate_section_totals(items, section_totals):
    """
    Validate that sum of inline marks for each main question matches section total.
    Flag variance > 0 with yellow confidence.
    """
    # Group items by main question number
    main_questions = {}
    for item in items:
        q_num = item['question_number']
        main_q = q_num.split('.')[0]
        if main_q not in main_questions:
            main_questions[main_q] = []
        main_questions[main_q].append(item)

    # Validate each section
    for main_q, total in section_totals.items():
        if main_q not in main_questions:
            continue

        # Sum marks of all non-header items in this section
        section_items = [i for i in main_questions[main_q] 
                        if not i.get('is_header') and i['question_number'] != main_q]
        inline_sum = sum(i.get('final_marks', 0) for i in section_items)

        # Also sum header marks (which are sums of their sub-items)
        header_items = [i for i in main_questions[main_q] if i.get('is_header')]
        header_sum = sum(i.get('header_marks', 0) for i in header_items)

        total_calculated = inline_sum + header_sum
        variance = total - total_calculated

        if abs(variance) > 0:
            # Flag all items in this section with yellow confidence
            for item in main_questions[main_q]:
                if item.get('confidence') == 'green':
                    item['confidence'] = 'yellow'
                    if item.get('issue'):
                        item['issue'] += f"; Section total variance: {variance}"
                    else:
                        item['issue'] = f"Section total variance: {variance}"

    return items


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

    # Get all unique question numbers from content parsers
    all_q_nums = set(qp_content_dict.keys()) | set(memo_content_dict.keys())

    # === INFER MISSING MARKS FROM SECTION TOTALS ===
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
                    print(f"  Inferred: {q} = {allocated} marks (from Q{main_q} total {total})")

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
        section_total = section_totals.get(main_q, 0)
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
                                 (memo_content.get('has_visual_content', False) if memo_content else False),
            'is_header': 0,  # Will be set by post-processing
            'parent_header_q': None
        }

        if qp_content and memo_content:
            matched.append(item)
        elif qp_content and not memo_content:
            qp_only.append(item)
        elif memo_content and not qp_content:
            memo_only.append(item)

    # === POST-PROCESSING: HEADER DETECTION ===
    print("\n[6/5] Post-processing: Header detection...")
    all_items = matched + qp_only + memo_only
    all_items, header_map = _detect_headers(all_items)

    if header_map:
        print(f"  Detected {len(header_map)} headers:")
        for hq, info in header_map.items():
            print(f"    {hq}: {info['marks']} marks (sub-items: {', '.join(info['sub_items'])})")
    else:
        print("  No headers detected")

    # === POST-PROCESSING: SECTION TOTALS VALIDATION ===
    print("\n[7/5] Post-processing: Section totals validation...")
    all_items = _validate_section_totals(all_items, section_totals)

    # Re-split into categories
    matched = [i for i in all_items if i in matched]
    qp_only = [i for i in all_items if i in qp_only]
    memo_only = [i for i in all_items if i in memo_only]

    # Calculate totals and confidence distribution
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

    result = {
        'status': 'success',
        'paper_code': paper_code,
        'parser_version': 'v30-tweaked',
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
        'header_map': header_map  # NEW: for batch_parser.js to use
    }

    return result


if __name__ == '__main__':
    if len(sys.argv) >= 3:
        result = run_harness_v2(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'TEST')
        print("\n=== FINAL OUTPUT ===")
        print(json.dumps(result, indent=2))
