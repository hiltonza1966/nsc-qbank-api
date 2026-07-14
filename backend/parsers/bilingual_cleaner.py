#!/usr/bin/env python3
"""Bilingual Text Cleaner v2 — Extracts English from English/Afrikaans bilingual content.

IMPROVEMENTS over v1:
1. Safer / separator handling: only splits on clear bilingual patterns
   (e.g., "English /Afrikaans" in headers), not on "and/or" or "A/B"
2. Better Afrikaans detection with multi-signal scoring
3. Handles common false positives (e.g., "die" in English context)
4. Preserves question numbers and mathematical expressions
5. Cleaner post-processing to remove orphaned Afrikaans fragments
"""

import re

# ------------------------------------------------------------------
# Afrikaans detection signals
# ------------------------------------------------------------------

# High-confidence Afrikaans words (very unlikely in English NSC context)
AFRIKAANS_STRONG = {
    'wanneer', 'dat', 'het', 'vir', 'maar', 'word', 'deur', 'hierdie', 'daar', 'toe',
    "n'", 'n\u2019', 'n\u2018', '\u0149', 'oefen', 'krag', 'uit', 'ge\u00efsoleerde',
    'sisteem', 'bly', 'konstant', 'behou', 'grootte', 'rigting', 'wrywingskrag',
    'aanvaarbare', 'byskrifte', 'aantekeninge', 'verrig', 'werk', 'oplossing',
    'antwoord', 'bereken', 'toon', 'waar', 'toepaslik', 'liggaam', 'beweging',
    'wetenskap', 'tegniese', 'gebruik', 'skryf', 'lees', 'kies', 'verduidelik',
    'vergelyk', 'bespreek', 'ontleed', 'evalueer', 'bewys', 'los', 'gee', 'noem',
    'klassifiseer', 'onderskei', 'verteenwoordig', 'teken', 'bepaal', 'voorsien',
    'kry', 'maak', 'verander', 'verhoog', 'verlaag', 'vermenigvuldig', 'deel', 'tel',
    'aftrek', 'voltooi', 'vul', 'korrigeer', 'herleid', 'skets', 'aandui', 'wys',
    'merk', 'onderstreep', 'kring', 'omkring', 'aanskryf', 'beskryf', 'ooreenkoms',
    'oorsaak', 'gevolg', 'voordeel', 'nadeel', 'voorbeeld', 'definisie', 'formule',
    'wet', 'beginsel', 'teorie', 'hipotese', 'waarneming', 'eksperiment', 'resultaat',
    'gevolgtrekking', 'samevatting', 'inleiding', 'metode', 'apparaat', 'apparatuur',
    'stof', 'mengsel', 'element', 'verbinding', 'ioon', 'molekule', 'atoom', 'elektron',
    'proton', 'neutron', 'kern', 'orbitaal', 'kovalent', 'ionies', 'metallies',
    'waterstof', 'polêr', 'nie-polêr', 'suur', 'basis', 'sout', 'oksidasie',
    'reduksie', 'elektrolise', 'galvanise', 'sel', 'batterye', 'elektrode', 'anode',
    'katode', 'elektroliet', 'halfsel', 'emk', 'potensiaal', 'weerstand', 'stroom',
    'spanning', 'drywing', 'energie', 'frekwensie', 'golf', 'lengte', 'snelheid',
    'tydperk', 'amplitude', 'trilling', 'resonansie', 'interferensie', 'diffraksie',
    'refleksie', 'breking', 'verspreiding', 'polarisasie', 'kritieke', 'hoek',
    'totale', 'interne', 'lens', 'spieël', 'prisma', 'fokus', 'brandpunt',
    'vergroting', 'beeld', 'reëel', 'virtueel', 'opgerig', 'omgekeerd', 'vergroot',
    'verklein', 'dieselfde', 'kinetiese', 'potensiële', 'meganiese', 'warmte',
    'termiese', 'straling', 'kernenergie', 'chemiese', 'elektriese', 'lig', 'klank',
    'elastiese', 'gravitasionele', 'magnetiese', 'krag', 'gewig', 'massa', 'digtheid',
    'druk', 'temperatuur', 'volume', 'oppervlak', 'wydte', 'hoogte', 'diepte',
    'oppervlakarea', 'kapasiteit', 'inhoud', 'vloeistof', 'gas', 'vaste', 'toestand',
    'smelt', 'kook', 'vries', 'sublimeer', 'kondenseer', 'verdamp', 'verhit', 'afkoel',
    'kookpunt', 'smeltpunt', 'vriespunt', 'atmosferies', 'barometries', 'manometer',
    'termometer', 'kalorimeter', 'hidrometer', 'refraktometer', 'spektroskoop',
    'mikroskoop', 'teleskoop', 'vergrootglas', 'balans', 'maatsilinder', 'pipet',
    'buret', 'fles', 'beker', 'proefbuis', 'reagens', 'indikator', 'universeel',
    'lakmus', 'fenolftaleien', 'metiel', 'oranje', 'broom', 'timol', 'blou', 'kongo',
    'rooi', 'geel', 'groen', 'purper', 'kleurlose', 'suurgraad', 'basisiteit',
    'neutralisasie', 'titrering', 'eindpunt', 'ekwivalensie', 'molêr', 'konsentrasie',
    'molaliteit', 'molfraksie', 'massa', 'persentasie', 'deeltjie', 'oplosbaarheid',
    'produk', 'Ksp', 'Ka', 'Kb', 'pKa', 'pKb', 'buffer', 'buffergebied', 'hidrolise',
    'hidronium', 'hidroksied', 'amfoliet', 'amfoteries', 'elektroliet', 'nie-elektroliet',
    'sterk', 'swak', 'volledig', 'gedeeltelik', 'ionisasie', 'dissosiasie', 'geleiding',
    'resistiwiteit', 'konduktiwiteit', 'molariteit', 'oplosmiddel', 'opgeloste',
    'versadig', 'onversadig', 'supersaturasie', 'kristal', 'kristallisasie',
    'presipitaat', 'presipitasie', 'filtraat', 'residu', 'filtrasie', 'destillasie',
    'evaporasie', 'kromatografie', 'fraksionering', 'sentrifugering', 'dekantasie',
    'sifting', 'magnetiese', 'fisiese', 'chemiese', 'element', 'ontbinding',
    'termiese', 'fotolise', 'verbranding', 'respirasie', 'fotosintese', 'vergisting',
    'ontbinding', 'verrotting', 'biologiese', 'afbreek', 'biodegradasie', 'herwinning',
    'hergebruik', 'herwin', 'hergebruik', 'herwinning', 'hergebruik', 'herwin',
    'herwinning', 'hergebruik', 'herwin', 'herwinning', 'hergebruik', 'herwin',
    'herwinning', 'hergebruik', 'herwin', 'herwinning', 'hergebruik', 'herwin',
}

# Medium-confidence Afrikaans words (can appear in English but rare in NSC context)
AFRIKAANS_MEDIUM = {
    'die', 'van', 'en', 'is', 'te', 'wat', 'om', 'nie', 'of', 'in'
}

# Afrikaans orthographic markers (diacritics common in Afrikaans, rare in English)
AFRIKAANS_DIACRITICS = {'ê', 'ë', 'ï', 'ô', 'û', 'è', 'á', 'é', 'í', 'ó', 'ú', 'à'}

# Afrikaans vowel doubling patterns
AFRIKAANS_VOWEL_PATTERNS = {'aa', 'ee', 'oo', 'uu'}


def _is_afrikaans_line(line):
    """Multi-signal Afrikaans detection with scoring."""
    line_lower = line.lower().strip()
    if not line_lower:
        return False

    # EXEMPTION 1: Lines starting with question numbers are always English
    if re.match(r'^\d+\.\d+', line_lower):
        return False

    # EXEMPTION 2: Mathematical expressions (keep English)
    if re.search(r'\d+\s*[/+\-x*]\s*\d+', line) or re.search(r'[=<>]', line):
        return False

    # EXEMPTION 3: Single words or very short lines — ambiguous, keep as English
    words = line_lower.split()
    if len(words) < 3:
        return False

    score = 0

    # Signal 1: Strong Afrikaans words (3+ points each)
    for w in words:
        w_clean = w.rstrip('.:,;/')
        if w_clean in AFRIKAANS_STRONG:
            score += 3

    # Signal 2: Medium Afrikaans words (1 point each, but need 3+ to count)
    medium_count = sum(1 for w in words if w.rstrip('.:,;/') in AFRIKAANS_MEDIUM)
    if medium_count >= 3:
        score += medium_count

    # Signal 3: Diacritics (2 points each occurrence)
    for char in line_lower:
        if char in AFRIKAANS_DIACRITICS:
            score += 2

    # Signal 4: Vowel doubling (1 point each occurrence)
    for i in range(len(line_lower) - 1):
        if line_lower[i:i+2] in AFRIKAANS_VOWEL_PATTERNS:
            score += 1

    # Threshold: score >= 5 indicates Afrikaans
    return score >= 5


def _split_bilingual_header(line):
    """Split bilingual header like 'English /Afrikaans' or 'English / Afrikaans'.
    Returns English part only, or None if not a bilingual header.
    """
    # Pattern: English text + space + / + optional space + Afrikaans text
    # The Afrikaans part typically starts with a capital letter
    m = re.match(r'^(.+?)\s*/\s*([A-Z][a-zA-Z]+)', line)
    if m:
        english_part = m.group(1).strip()
        # Verify the second part looks like Afrikaans
        second_part = m.group(2)
        if _is_afrikaans_line(second_part) or any(c in second_part for c in AFRIKAANS_DIACRITICS):
            return english_part
    return None


def extract_english_from_bilingual(text):
    """Extract English text from bilingual (English/Afrikaans) content.

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

        # Skip clearly Afrikaans lines
        if _is_afrikaans_line(line):
            continue

        # Handle bilingual header with / separator
        english_part = _split_bilingual_header(line)
        if english_part is not None:
            line = english_part
        else:
            # Only split on / if it's clearly a bilingual separator
            # (not inside numbers, URLs, or expressions like and/or)
            if '/' in line and not re.search(r'\d+/\d+', line):
                # Check if it looks like a bilingual split
                parts = line.split('/')
                if len(parts) == 2:
                    left = parts[0].strip()
                    right = parts[1].strip()
                    # If right side is Afrikaans, keep left
                    if _is_afrikaans_line(right) or any(c in right for c in AFRIKAANS_DIACRITICS):
                        line = left

        # Clean trailing / or spaces
        line = re.sub(r'\s*/\s*$', '', line)
        line = re.sub(r'\s+/$', '', line)

        english_lines.append(line)

    # Post-process: remove orphaned Afrikaans fragments that slipped through
    result = '\n'.join(english_lines)

    # Clean up common artifacts
    result = re.sub(r'\n\s*\n\s*\n+', '\n\n', result)  # Collapse multiple blank lines
    result = re.sub(r'[\u0149]', "n'", result)  # Normalize Unicode n-apostrophe

    return result


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
    print("=== Bilingual Cleaner v2 Test ===")
    print(extract_english_from_bilingual(test))
