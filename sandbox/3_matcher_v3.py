#!/usr/bin/env python3
"""Matcher v3 - Cross-references QP and Memo items by question number"""

def match_items_v3(qp_items, memo_items):
    qp_dict = {item['question_number']: item for item in qp_items}
    memo_dict = {item['question_number']: item for item in memo_items}

    # Sort by question number
    all_numbers = sorted(
        set(qp_dict.keys()) | set(memo_dict.keys()),
        key=lambda x: [int(n) for n in x.split('.')]
    )

    matched = []
    qp_only = []
    memo_only = []

    for num in all_numbers:
        qp_item = qp_dict.get(num)
        memo_item = memo_dict.get(num)

        if qp_item and memo_item:
            # Both found - use memo marks (authoritative), QP text
            matched.append({
                'question_number': num,
                'question_text': qp_item['question_text'],
                'answer_text': memo_item['answer_text'],
                'qp_marks': qp_item['marks'],
                'memo_marks': memo_item['marks'],
                'final_marks': memo_item['marks'] if memo_item['marks'] > 0 else qp_item['marks'],
                'status': 'matched'
            })
        elif qp_item:
            qp_only.append({
                'question_number': num,
                'question_text': qp_item['question_text'],
                'qp_marks': qp_item['marks'],
                'final_marks': qp_item['marks'],
                'status': 'qp_only'
            })
        elif memo_item:
            memo_only.append({
                'question_number': num,
                'answer_text': memo_item['answer_text'],
                'memo_marks': memo_item['marks'],
                'final_marks': memo_item['marks'],
                'status': 'memo_only'
            })

    return matched, qp_only, memo_only
