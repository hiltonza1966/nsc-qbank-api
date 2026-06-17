#!/usr/bin/env python3
"""Review Generator v3 - Confidence scoring with Green/Yellow/Red flags"""

def generate_review_v3(matched_items, qp_only_items, memo_only_items):
    green = []   # Confident - no review needed
    yellow = []  # Caution - recommend checking
    red = []     # Needs review - must fix

    all_items = matched_items + qp_only_items + memo_only_items

    for item in all_items:
        q_num = item['question_number']
        final_marks = item['final_marks']
        qp_marks = item.get('qp_marks', 0)
        memo_marks = item.get('memo_marks', 0)
        answer_text = item.get('answer_text', '')
        question_text = item.get('question_text', '')

        # RED: No marks found anywhere
        if final_marks == 0:
            red.append({
                **item,
                'issue': 'No marks found in QP or Memo',
                'confidence': 'red',
                'review_action': 'Add marks manually'
            })

        # RED: Missing critical data
        elif not question_text and not answer_text:
            red.append({
                **item,
                'issue': 'Missing both question text and answer',
                'confidence': 'red',
                'review_action': 'Add missing content'
            })

        # YELLOW: QP and Memo marks differ significantly
        elif qp_marks > 0 and memo_marks > 0 and abs(qp_marks - memo_marks) > 1:
            yellow.append({
                **item,
                'issue': f'Mark mismatch: QP={qp_marks}, Memo={memo_marks}',
                'confidence': 'yellow',
                'review_action': 'Verify correct marks'
            })

        # YELLOW: Short answer but multiple marks
        elif len(answer_text) < 10 and final_marks > 2:
            yellow.append({
                **item,
                'issue': f'Short answer ({len(answer_text)} chars) for {final_marks} marks',
                'confidence': 'yellow',
                'review_action': 'Verify answer completeness'
            })

        # YELLOW: High marks for non-essay question
        elif final_marks >= 6 and not any(x in (question_text + answer_text).lower() 
                                          for x in ['paragraph', 'essay', 'discuss', 'explain', 'suggest']):
            yellow.append({
                **item,
                'issue': f'High marks ({final_marks}) - verify not section total',
                'confidence': 'yellow',
                'review_action': 'Verify mark allocation'
            })

        # GREEN: All good
        else:
            green.append({
                **item,
                'confidence': 'green',
                'review_action': 'None - auto-approve'
            })

    return green, yellow, red
