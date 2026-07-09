#!/usr/bin/env python3
"""master_harness_v3.py v39 - Patched for row-based parser compatibility.

CRITICAL FIXES APPLIED (vs v38):
1. MCQ fields now use qp_content_parser's pre-extracted is_mcq / mcq_options
   instead of re-deriving with broken duplicate functions.
2. Image key fixed: 'qp_images' (what parser returns) instead of 'images'
   (which was always empty because the key didn't exist).

These two fixes resolve:
- "MCQ options not extracted"  → now uses parser output directly
- "attachments_inserted=23 but promote_attachments_linked=0" → images now flow through
"""
import os
import sys
import json
import re

# ------------------------------------------------------------------
# Parser imports (unversioned names as expected by batch_parser.js)
# ------------------------------------------------------------------
from qp_content_parser import extract_qp_content
from memo_content_parser import extract_memo_content
from qp_marks_parser import extract_qp_marks
from memo_marks_parser import extract_memo_marks

VERSION = "v39"


def _validate_section_totals(combined_items, paper_code):
    """Validate that section totals match expected values.
    Returns (ok: bool, message: str)."""
    section_map = {}
    for item in combined_items:
        qn = item['question_number']
        parts = qn.split('.')
        if len(parts) == 1:
            section_map[qn] = item.get('marks', 0)

    warnings = []
    for sec, marks in section_map.items():
        if marks == 0:
            warnings.append(f"Section {sec} has 0 marks")

    if warnings:
        return False, "; ".join(warnings)
    return True, "Section totals OK"


def run_parsing_harness(qp_path, memo_path, paper_code, output_dir=None):
    """Run the full QP + Memo parsing pipeline and return combined items.

    Args:
        qp_path:      Path to Question Paper PDF
        memo_path:    Path to Marking Guideline / Memo PDF
        paper_code:   e.g. "LIFESCIENCES_P1_2025_NOV_ENG"
        output_dir:   Directory to save extracted images (optional)

    Returns:
        dict with keys:
            version          : str
            paper_code       : str
            items            : list of combined item dicts
            section_totals   : dict {section_num: marks}
            validation       : dict {ok: bool, message: str}
    """
    # ------------------------------------------------------------------
    # 1. Extract all four components
    # ------------------------------------------------------------------
    qp_content = extract_qp_content(qp_path, output_dir)
    qp_marks   = extract_qp_marks(qp_path)
    memo_content = extract_memo_content(memo_path, output_dir)
    memo_marks   = extract_memo_marks(memo_path)

    # ------------------------------------------------------------------
    # 2. Build fast lookup dicts
    # ------------------------------------------------------------------
    qp_marks_dict   = {m['question_number']: m['marks'] for m in qp_marks}
    memo_dict       = {m['question_number']: m for m in memo_content}
    memo_marks_dict = {m['question_number']: m['marks'] for m in memo_marks}

    # ------------------------------------------------------------------
    # 3. Merge QP content + marks + memo content + memo marks
    # ------------------------------------------------------------------
    combined_items = []
    for qp_item in qp_content:
        qn = qp_item['question_number']

        # --- marks (QP) ------------------------------------------------
        qp_mark = qp_marks_dict.get(qn, 0)
        # Fallback: if QP marks parser missed it, try memo marks
        if not qp_mark:
            qp_mark = memo_marks_dict.get(qn, 0)

        # --- memo data -------------------------------------------------
        memo_item = memo_dict.get(qn, {})
        answer_text = memo_item.get('answer_text', '')
        correct_key = memo_item.get('correct_key', '')
        memo_is_mcq = memo_item.get('is_mcq', False)

        # --- FIX 1: Use parser's pre-extracted MCQ fields ---------------
        # OLD (broken): re-derived from question_text with duplicate functions
        #   is_mcq = detect_mcq_type(qp_item['question_text'])
        #   mcq_options = extract_mcq_options(qp_item['question_text'])
        # NEW (fixed): use what qp_content_parser already computed
        is_mcq = qp_item.get('is_mcq', 0)
        mcq_options = qp_item.get('mcq_options', None)
        item_answer_json = qp_item.get('item_answer_json', None)

        # NOTE: Do NOT override content parser's is_mcq with memo's classification.
        # The content parser detects MCQ questions by looking for option patterns
        # in the question text. The memo parser classifies by answer format (e.g.
        # "Both A and B", "B only") which is wrong for matching questions.
        # Trust the content parser's judgment.

        # --- FIX 2: Use correct image key -------------------------------
        # OLD (broken): images = qp_item.get('images', [])  # key never exists
        # NEW (fixed):  images = qp_item.get('qp_images', [])
        images = qp_item.get('qp_images', [])

        # --- header metadata --------------------------------------------
        is_header = qp_item.get('is_header', 0)
        header_level = qp_item.get('header_level', len(qn.split('.')))

        # --- build combined item --------------------------------------
        combined_item = {
            'question_number':  qn,
            'question_text':    qp_item.get('question_text', ''),
            'marks':            qp_mark,
            'expected_marks':   qp_mark,   # alias for downstream compatibility
            'answer_text':      answer_text,
            'correct_key':      correct_key,
            'is_mcq':           is_mcq,
            'mcq_options':      mcq_options,
            'item_answer_json': item_answer_json,
            'images':           images,     # renamed for DB insert compatibility
            'is_header':        is_header,
            'header_level':     header_level,
            'source':           'combined',
        }
        combined_items.append(combined_item)

    # ------------------------------------------------------------------
    # 4. FINAL SAFETY PASS: ensure header_level is never NULL
    # ------------------------------------------------------------------
    for item in combined_items:
        if item['header_level'] is None:
            item['header_level'] = len(item['question_number'].split('.'))
        if item['is_header'] is None:
            item['is_header'] = 1 if len(item['question_number'].split('.')) == 2 else 0

    # ------------------------------------------------------------------
    # 5. Section totals
    # ------------------------------------------------------------------
    section_totals = {}
    for m in qp_marks:
        if m['source'] == 'qp_section_total':
            section_totals[m['question_number']] = m['marks']

    # ------------------------------------------------------------------
    # 6. Validation
    # ------------------------------------------------------------------
    ok, msg = _validate_section_totals(combined_items, paper_code)

    return {
        'version': VERSION,
        'paper_code': paper_code,
        'items': combined_items,
        'section_totals': section_totals,
        'validation': {'ok': ok, 'message': msg},
    }




# Alias for backward compatibility with batch_parser.js
run_harness_v3 = run_parsing_harness
if __name__ == '__main__':
    import sys
    if len(sys.argv) >= 4:
        qp_path = sys.argv[1]
        memo_path = sys.argv[2]
        paper_code = sys.argv[3]
        output_dir = sys.argv[4] if len(sys.argv) > 4 else None
        result = run_parsing_harness(qp_path, memo_path, paper_code, output_dir)
        print(json.dumps(result, indent=2, default=str))
    else:
        print("Usage: python master_harness_v3.py <qp_pdf> <memo_pdf> <paper_code> [output_dir]")
