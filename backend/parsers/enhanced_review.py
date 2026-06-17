#!/usr/bin/env python3
"""Enhanced Review Generator for QBank Parser"""
import json
import sys
from datetime import datetime

def generate_review(result_json_path, output_path=None):
    with open(result_json_path, "r") as f:
        result = json.load(f)
    review = {
        "metadata": {
            "paper_code": result.get("paper_code", "Unknown"),
            "generated_at": datetime.now().isoformat(),
            "parser_version": result.get("parser_version", "v19"),
            "status": "PASS" if abs(result.get("variance", 999)) <= 5 else "REVIEW"
        },
        "executive_summary": {
            "total_marks": result.get("total_marks", 0),
            "target_marks": result.get("target_marks", 150),
            "variance": result.get("variance", 0),
            "items_total": result.get("matched", 0) + result.get("qp_only", 0) + result.get("memo_only", 0),
            "matched": result.get("matched", 0),
            "qp_only": result.get("qp_only", 0),
            "memo_only": result.get("memo_only", 0),
            "coverage_pct": round((result.get("total_marks", 0) / result.get("target_marks", 150)) * 100, 1)
        },
        "flag_summary": {
            "green": {
                "count": result.get("green_count", 0),
                "description": "Auto-approved - QP and Memo marks agree",
                "action": "No action needed"
            },
            "yellow": {
                "count": result.get("yellow_count", 0),
                "description": "Review recommended - Mark mismatch or suspicious pattern",
                "action": "Verify marks manually"
            },
            "red": {
                "count": result.get("red_count", 0),
                "description": "Critical issue - Missing marks or data",
                "action": "Must fix before import"
            }
        },
        "detailed_items": {
            "red": result.get("red_items", []),
            "yellow": result.get("yellow_items", []),
            "green": result.get("green_items", [])
        },
        "recommendations": generate_recommendations(result)
    }
    if output_path:
        with open(output_path, "w") as f:
            json.dump(review, f, indent=2)
    return review

def generate_recommendations(result):
    recommendations = []
    red_count = result.get("red_count", 0)
    yellow_count = result.get("yellow_count", 0)
    variance = result.get("variance", 0)
    if red_count > 0:
        recommendations.append({
            "priority": "CRITICAL",
            "issue": f"{red_count} items have no marks or missing data",
            "action": "Fix all red items before importing",
            "items": [r["q"] for r in result.get("red_items", [])]
        })
    if yellow_count > 0:
        recommendations.append({
            "priority": "HIGH",
            "issue": f"{yellow_count} items need mark verification",
            "action": "Review yellow items and confirm correct marks",
            "items": [y["q"] for y in result.get("yellow_items", [])]
        })
    if abs(variance) > 10:
        recommendations.append({
            "priority": "HIGH",
            "issue": f"Mark variance of {variance} from target",
            "action": "Check for missing items or section totals misidentified"
        })
    if result.get("qp_only", 0) > 0:
        recommendations.append({
            "priority": "MEDIUM",
            "issue": f"{result.get('qp_only', 0)} items found only in QP",
            "action": "Check if memo file is complete"
        })
    if not recommendations:
        recommendations.append({
            "priority": "LOW",
            "issue": "All checks passed",
            "action": "Ready for import"
        })
    return recommendations

def print_console_review(review):
    print("=" * 80)
    print("QBank Parser Review Report")
    print(f"Paper: {review['metadata']['paper_code']}")
    print(f"Status: {review['metadata']['status']}")
    print("=" * 80)
    es = review["executive_summary"]
    print(f"Total Marks: {es['total_marks']} / {es['target_marks']}")
    print(f"Coverage: {es['coverage_pct']}%")
    print("\n--- RECOMMENDATIONS ---")
    for rec in review["recommendations"]:
        print(f"[{rec['priority']}] {rec['issue']}")
        print(f"  Action: {rec['action']}")
    print("\n" + "=" * 80)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python enhanced_review.py <parser_result.json> [output.json]")
        sys.exit(1)
    result_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    review = generate_review(result_path, output_path)
    print_console_review(review)
