#!/usr/bin/env python3
"""Bilingual Text Cleaner - Extracts English from English/Afrikaans bilingual content.

SURGICAL TWEAKS APPLIED:
1. Expanded Afrikaans word list with more common words
2. Improved handling of / separator
3. Better detection of Afrikaans-only lines
"""

import re

# Common Afrikaans words that indicate an Afrikaans line
AFRIKAANS_STARTERS = [
    'wanneer', 'die', 'dat', 'het', 'en', 'om', 'in', 'is', 'van', 'te',
    'vir', 'maar', 'word', 'deur', 'wat', 'hierdie', 'daar', 'toe',
    "n'", 'n\u2019', 'n\u2018', '\u0149', 'of', 'nie', 'oefen', 'krag', 'uit',
    'ge\u00efsoleerde', 'sisteem', 'bly', 'konstant', 'behou', 'grootte', 'rigting',
    'wrywingskrag', 'aanvaarbare', 'byskrifte', 'aantekeninge', 'verrig',
    'werk', 'oplossing', 'antwoord', 'bereken', 'toon', 'alle', 'waar',
    'toepaslik', 'liggaam', 'beweging', 'wet', 'wetenskap', 'tegniese',
    # NEW: Expanded list
    'gebruik', 'skryf', 'lees', 'kies', 'verduidelik', 'vergelyk', 'bespreek',
    'ontleed', 'evalueer', 'bewys', 'los', 'op', 'gee', 'noem', 'klassifiseer',
    'onderskei', 'verteenwoordig', 'teken', 'bepaal', 'voorsien', 'kry', 'maak',
    'verander', 'verhoog', 'verlaag', 'vermenigvuldig', 'deel', 'tel', 'aftrek',
    'voltooi', 'vul', 'in', 'korrigeer', 'herleid', 'bereken', 'skets', 'teken',
    'aandui', 'wys', 'merk', 'onderstreep', 'kring', 'omkring', 'aanskryf',
    'verduidelik', 'beskryf', 'bespreek', 'evalueer', 'ontleed', 'vergelyk',
    'verskil', 'ooreenkoms', 'oorsaak', 'gevolg', 'voordeel', 'nadeel',
    'voorbeeld', 'definisie', 'formule', 'wet', 'beginsel', 'teorie',
    'hipotese', 'waarneming', 'eksperiment', 'resultaat', 'gevolgtrekking',
    'samevatting', 'inleiding', 'metode', 'apparaat', 'apparatuur',
    'stof', 'mengsel', 'element', 'verbinding', 'ioon', 'molekule',
    'atoom', 'elektron', 'proton', 'neutron', 'kern', 'orbitaal',
    'kovalent', 'ionies', 'metallies', 'waterstof', 'polêr', 'nie-polêr',
    'suur', 'basis', 'sout', 'oksidasie', 'reduksie', 'elektrolise',
    'galvanise', 'sel', 'batterye', 'elektrode', 'anode', 'katode',
    'elektroliet', 'halfsel', 'emk', 'potensiaal', 'weerstand',
    'stroom', 'spanning', 'drywing', 'energie', 'frekwensie',
    'golf', 'lengte', 'snelheid', 'tydperk', 'amplitude',
    'trilling', 'resonansie', 'interferensie', 'diffraksie',
    'refleksie', 'breking', 'verspreiding', 'polarisasie',
    'kritieke', 'hoek', 'totale', 'interne', 'refleksie',
    'lens', 'spieël', 'prisma', 'fokus', 'brandpunt',
    'vergroting', 'beeld', 'reëel', 'virtueel', 'opgerig',
    'omgekeerd', 'vergroot', 'verklein', 'dieselfde', 'grootte',
    'kinetiese', 'energie', 'potensiële', 'meganiese', 'warmte',
    'termiese', 'straling', 'kernenergie', 'chemiese', 'elektriese',
    'lig', 'klank', 'elastiese', 'gravitasionele', 'magnetiese',
    'krag', 'gewig', 'massa', 'digtheid', 'druk', 'temperatuur',
    'volume', 'oppervlak', 'lengte', 'wydte', 'hoogte', 'diepte',
    'oppervlakarea', 'volume', 'kapasiteit', 'inhoud', 'vloeistof',
    'gas', 'vaste', 'toestand', 'smelt', 'kook', 'vries', 'sublimeer',
    'kondenseer', 'verdamp', 'verhit', 'afkoel', 'temperatuur',
    'kookpunt', 'smeltpunt', 'vriespunt', 'kritieke', 'temperatuur',
    'druk', 'atmosferies', 'barometries', 'manometer', 'termometer',
    'kalorimeter', 'hidrometer', 'refraktometer', 'spektroskoop',
    'mikroskoop', 'teleskoop', 'vergrootglas', 'balans', 'maatsilinder',
    'pipet', 'buret', 'fles', 'beker', 'proefbuis', 'reagens',
    'indikator', 'universeel', 'lakmus', 'fenolftaleien', 'metiel',
    'oranje', 'broom', 'timol', 'blou', 'kongo', 'rooi', 'geel',
    'groen', 'purper', 'kleurlose', 'pH', 'suurgraad', 'basisiteit',
    'neutralisasie', 'titrering', 'eindpunt', 'ekwivalensie',
    'molêr', 'konsentrasie', 'molaliteit', 'molfraksie',
    'massa', 'persentasie', 'volume', 'persentasie', 'deeltjie',
    'konsentrasie', 'oplosbaarheid', 'produk', 'oplosbaarheid',
    'Ksp', 'Ka', 'Kb', 'pKa', 'pKb', 'buffer', 'buffergebied',
    'hidrolise', 'hidronium', 'hidroksied', 'amfoliet',
    'amfoteries', 'Lewis', 'Brønsted', 'Lowry', 'Arrhenius',
    'elektroliet', 'nie-elektroliet', 'sterk', 'swak',
    'volledig', 'gedeeltelik', 'ionisasie', 'dissosiasie',
    'elektriese', 'geleiding', 'resistiwiteit', 'konduktiwiteit',
    'molariteit', 'molaliteit', 'molfraksie', 'massa',
    'persentasie', 'volume', 'persentasie', 'deeltjie',
    'konsentrasie', 'oplosmiddel', 'opgeloste', 'stof',
    'versadig', 'onversadig', 'supersaturasie', 'kristal',
    'kristallisasie', 'presipitaat', 'presipitasie', 'filtraat',
    'residu', 'filtrasie', 'destillasie', 'evaporasie',
    'kromatografie', 'fraksionering', 'sentrifugering',
    'dekantasie', 'sifting', 'magnetiese', 'skeiding',
    'fisiese', 'skeiding', 'chemiese', 'skeiding',
    'element', 'metode', 'ontbinding', 'elektrolise',
    'termiese', 'ontbinding', 'fotolise', 'hidrolise',
    'oksidasie', 'reduksie', 'verbranding', 'respirasie',
    'fotosintese', 'vergisting', 'ontbinding', 'verrotting',
    'biologiese', 'afbreek', 'biodegradasie', 'herwinning',
    'hergebruik', 'herwin', 'hergebruik', 'herwinning',
    'hergebruik', 'herwin', 'hergebruik', 'herwinning',
]


def is_afrikaans_line(line):
    """Check if a line is primarily Afrikaans."""
    line_lower = line.lower().strip()
    if not line_lower:
        return False

    # FIX: If line starts with a question number, it's likely English
    # Question numbers like "1.1", "2.3", "3.1.1" should be preserved
    if re.match(r'^\d+\.\d+', line_lower):
        return False

    first_word = line_lower.split()[0].rstrip('.:,;/') if line_lower.split() else ''
    if first_word in AFRIKAANS_STARTERS:
        if re.match(r'^\d+\.\d+', first_word):
            return False
        return True

    afr_indicators = ['aa', 'ee', 'oo', 'uu', 'ê', 'ë', 'ï', 'ô', 'û']
    if any(ind in line_lower for ind in afr_indicators):
        afr_words = ['die', 'van', 'en', 'is', 'te', 'wat', 'vir', 'om', 'nie', "n'", '\u0149', 'oefen', 'krag']
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
