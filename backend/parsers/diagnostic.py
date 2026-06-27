#!/usr/bin/env python3
"""Diagnostic script to check parser status and test with timeout"""
import sys
import os
import json
import subprocess
import time

PARSERS_DIR = os.path.dirname(os.path.abspath(__file__))

def test_parser_with_timeout(qp_path, memo_path, paper_code, timeout=30):
    """Test parser with explicit timeout to diagnose hanging"""
    print(f"Testing parser for {paper_code}...")
    print(f"QP: {qp_path}")
    print(f"Memo: {memo_path}")

    # Check files exist
    if not os.path.exists(qp_path):
        print(f"ERROR: QP file not found: {qp_path}")
        return None
    if not os.path.exists(memo_path):
        print(f"ERROR: Memo file not found: {memo_path}")
        return None

    print("Files found. Starting parser...")

    # Run with subprocess and timeout
    try:
        result = subprocess.run(
            [sys.executable, '-u', os.path.join(PARSERS_DIR, 'parser_api_v2.py'), 
             'parse', qp_path, memo_path, paper_code],
            cwd=PARSERS_DIR,
            capture_output=True,
            text=True,
            timeout=timeout
        )

        print(f"Return code: {result.returncode}")
        print(f"Stdout length: {len(result.stdout)}")
        print(f"Stderr length: {len(result.stderr)}")

        if result.stderr:
            print(f"Stderr: {result.stderr[:500]}")

        if result.stdout:
            lines = result.stdout.strip().split('\n')
            print(f"Output lines: {len(lines)}")
            if lines:
                last_line = lines[-1]
                print(f"Last line: {last_line[:200]}")
                try:
                    data = json.loads(last_line)
                    print(f"Status: {data.get('status', 'unknown')}")
                    return data
                except:
                    print("Could not parse last line as JSON")

        return None
    except subprocess.TimeoutExpired:
        print(f"TIMEOUT: Parser hung after {timeout} seconds")
        return None
    except Exception as e:
        print(f"ERROR: {e}")
        return None

if __name__ == '__main__':
    if len(sys.argv) >= 4:
        qp = sys.argv[1]
        memo = sys.argv[2]
        code = sys.argv[3]
        timeout = int(sys.argv[4]) if len(sys.argv) > 4 else 30
        test_parser_with_timeout(qp, memo, code, timeout)
    else:
        print("Usage: python diagnostic.py <qp_path> <memo_path> <paper_code> [timeout]")
