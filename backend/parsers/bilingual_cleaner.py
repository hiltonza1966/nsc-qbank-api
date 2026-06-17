#!/usr/bin/env python3
"""Bilingual Text Cleaner - Extracts English from English/Afrikaans bilingual content."""

import re

# Common Afrikaans words that indicate an Afrikaans line
AFRIKAANS_STARTERS = [
    'wanneer', 'die', 'dat', 'het', 'en', 'om', 'in', 'is', 'van', 'te',
    'vir', 'maar', 'word', 'deur', 'wat', 'hierdie', 'daar', 'toe',
    "n'", 'n\u2019', 'n\u2018', 'ŉ', 'of', 'nie', 'oefen', 'krag', 'uit',
    'geïsoleerde', 'sisteem', 'bly', 'konstant', 'behou', 'grootte', 'rigting',
    'wrywingskrag', 'aanvaarbare', 'byskrifte', 'aantekeninge', 'verrig',
    'werk', 'oplossing', 'antwoord', 'bereken', 'toon', 'alle', 'waar',
    'toepaslik', 'liggaam', 'beweging', 'wet', 'wetenskap', 'tegniese'
]

def is_afrikaans_line(line):
    """Check if a line is primarily Afrikaans."""
    line_lower = line.lower().strip()
    if not line_lower:
        return False

    first_word = line_lower.split()[0].rstrip('.:,;/') if line_lower.split() else ''
    if first_word in AFRIKAANS_STARTERS:
        if re.match(r'^\d+\.\d+', first_word):
            return False
        return True

    afr_indicators = ['aa', 'ee', 'oo', 'uu', 'ê', 'ë', 'ï', 'ô', 'û']
    if any(ind in line_lower for ind in afr_indicators):
        afr_words = ['die', 'van', 'en', 'is', 'te', 'wat', 'vir', 'om', 'nie', "n'", 'ŉ', 'oefen', 'krag']
        words = line_lower.split()
        afr_count = sum(1 for w in words if w.rstrip('.:,;') in afr_words)
        if afr_count >= 2:
            return True

    return False

def extract_english_from_bilingual(text):
    """
    Extract English text from bilingual (English/Afrikaans) content.
    Handles:
    - Headers with "/" separator: "QUESTION /VRAAG 1" -> "QUESTION 1"
    - Parallel labels: "Marking Guidelines /Nasienriglyne" -> "Marking Guidelines"
    - Answer text with English first, then Afrikaans translation on separate lines
    - Returns cleaned English text
    """
    lines = text.split('\n')
    english_lines = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if is_afrikaans_line(line):
            continue

        if '/' in line and not re.search(r'\d+/\d+', line):
            parts = line.split('/')
            english_part = parts[0].strip()
            english_part = re.sub(r'\s+$', '', english_part)
            line = english_part

        line = re.sub(r'\s*/\s*$', '', line)
        line = re.sub(r'\s+\/\s*$', '', line)

        english_lines.append(line)

    return '\n'.join(english_lines)

def clean_memo_text(page_texts):
    """Clean bilingual memo text from list of page texts."""
    all_text = '\n'.join(page_texts)
    return extract_english_from_bilingual(all_text)


if __name__ == '__main__':
    test = """QUESTION /VRAAG 1
2.1 Newton's Third law of motion. /Newton se Derde bewegingswet
When body A exerts a force on body B, body B simultaneously exerts a force
Wanneer liggaam A 'n krag op liggaam B uitoefen, oefen liggaam B gelyktydig 'n krag uit
(3)
"""
    print(extract_english_from_bilingual(test))
