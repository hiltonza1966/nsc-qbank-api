#!/usr/bin/env python3
"""
Sandbox Harness v13 - Tests parser with detailed logging and diagnostics
Usage: python harness.py <qp_pdf> <memo_pdf> [paper_code]

Improvements over v12:
- Better logging of missing marks
- Section analysis
- Detailed red flag reporting
- Cross-page marks detection validation
"""

import sys
import json
import os
import logging
from datetime import datetime

# Setup logging
log_file = f'parser_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'
logging.basicConfig(
    filename=log_file,
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Add scripts directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from extract_dbe_paper import parse_pdf, compare_qp_memo


def run_test(qp_path, mg_path, paper_code=""):
    """Run parser test with both QP and Memo PDFs."""
    try:
        logging.info(f"=== Starting test for paper: {paper_code} ===")
        logging.info(f"QP PDF: {qp_path}")
        logging.info(f"Memo PDF: {mg_path}")

        # Parse QP
        logging.info("Parsing QP PDF...")
        qp_items_list, qp_hash = parse_pdf(qp_path, is_memo=False)
        logging.info(f"QP items extracted: {len(qp_items_list)}")
        logging.info(f"QP marks sum: {sum(item['parser_extracted_marks'] for item in qp_items_list)}")

        # Parse Memo
        logging.info("Parsing Memo PDF...")
        mg_items_list, mg_hash = parse_pdf(mg_path, is_memo=True)
        logging.info(f"Memo items extracted: {len(mg_items_list)}")
        logging.info(f"Memo marks sum: {sum(item['parser_extracted_marks'] for item in mg_items_list)}")

        # Convert to dict for comparison
        qp_items = {item['question_number']: item for item in qp_items_list}
        mg_items = {item['question_number']: item for item in mg_items_list}

        # Compare
        logging.info("Comparing QP and Memo...")
        report = compare_qp_memo(qp_items, mg_items)
        red_flags = [r for r in report if r['is_red_flag']]

        # Calculate totals from combined marks
        total_qp_marks = sum(r['qp_marks'] for r in report)
        total_mg_marks = sum(r['mg_marks'] for r in report)
        total_final_marks = sum(r['final_marks'] for r in report)

        # Find missing marks
        missing_marks = [r for r in report if r['final_marks'] == 0]
        logging.warning(f"Questions with NO marks: {len(missing_marks)}")
        for m in missing_marks[:15]:
            logging.warning(f"  {m['question_number']}: QP={m['qp_marks']} MG={m['mg_marks']} | Text: {m['qp_text'][:60]}")

        # Find red flags
        logging.warning(f"Red flags: {len(red_flags)}")
        for r in red_flags[:10]:
            logging.warning(f"  {r['question_number']}: QP={r['qp_marks']} MG={r['mg_marks']} var={r['variance']} | {r['qp_text'][:50]}")

        # Build analysis result
        analysis = {
            "paper_code": paper_code,
            "qp_items": len(qp_items),
            "qp_marks": total_qp_marks,
            "mg_items": len(mg_items),
            "mg_marks": total_mg_marks,
            "final_marks": total_final_marks,
            "missing_marks_count": len(missing_marks),
            "red_flags": len(red_flags),
            "qp_hash": qp_hash[:8],
            "mg_hash": mg_hash[:8],
            "top_issues": []
        }

        # Add top issues (red flags)
        for r in red_flags[:10]:
            analysis["top_issues"].append({
                "question_number": r['question_number'],
                "qp_marks": r['qp_marks'],
                "mg_marks": r['mg_marks'],
                "final_marks": r['final_marks'],
                "variance": r['variance'],
                "qp_text": r['qp_text'][:60],
                "mg_text": r['mg_text'][:60]
            })

        # Add missing marks to top issues if no red flags
        if not red_flags and missing_marks:
            for m in missing_marks[:10]:
                analysis["top_issues"].append({
                    "question_number": m['question_number'],
                    "qp_marks": m['qp_marks'],
                    "mg_marks": m['mg_marks'],
                    "final_marks": 0,
                    "variance": 0,
                    "qp_text": m['qp_text'][:60],
                    "mg_text": "NO MARKS FOUND"
                })

        logging.info(f"=== Test complete ===")
        logging.info(f"Final marks: {total_final_marks}")
        logging.info(f"Red flags: {len(red_flags)}")
        logging.info(f"Missing marks: {len(missing_marks)}")

        return analysis

    except Exception as e:
        logging.error(f"Test failed: {str(e)}")
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python harness.py <qp_pdf> <memo_pdf> [paper_code]")
        sys.exit(1)

    result = run_test(
        sys.argv[1],
        sys.argv[2],
        sys.argv[3] if len(sys.argv) > 3 else ""
    )
    print(json.dumps(result, indent=2))
    print(f"\nLog saved to: {log_file}")
