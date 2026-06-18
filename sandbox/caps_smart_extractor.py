#!/usr/bin/env python3
"""
QBank CAPS PDF Extractor - SMART Version
Uses keyword frequency analysis and fuzzy matching for topic detection.
"""

import fitz
import json
import sys
import re
from pathlib import Path
from collections import Counter

try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False

class SmartCapsExtractor:
    def __init__(self, use_gpu=False):
        self.reader = None
        if EASYOCR_AVAILABLE:
            print("Loading EasyOCR...")
            self.reader = easyocr.Reader(['en'], gpu=use_gpu)
            print("✓ EasyOCR ready")

    def _is_valid_text(self, text):
        if not text or len(text.strip()) < 30:
            return False
        printable = sum(1 for c in text if c.isprintable() or c.isspace())
        ratio = printable / len(text) if text else 0
        return ratio > 0.85

    def extract_all_pages(self, pdf_path, max_pages=15):
        doc = fitz.open(pdf_path)
        page_count = len(doc) if max_pages is None else min(max_pages, len(doc))
        doc.close()

        all_text = []
        for page_num in range(page_count):
            doc = fitz.open(pdf_path)
            page = doc[page_num]
            text = page.get_text()

            if not self._is_valid_text(text) and self.reader:
                pix = page.get_pixmap(matrix=fitz.Matrix(150/72, 150/72))
                img_data = pix.tobytes("png")
                temp_img = Path(f"temp_ocr_{page_num}.png")
                temp_img.write_bytes(img_data)
                results = self.reader.readtext(str(temp_img), detail=0, paragraph=True)
                text = "\n".join(results)
                temp_img.unlink(missing_ok=True)

            doc.close()
            all_text.append(text)

        return "\n".join(all_text)

    def identify_topics_smart(self, text, subject):
        """Smart topic detection using keyword frequency"""
        text_lower = text.lower()
        words = re.findall(r'\b[a-z]+\b', text_lower)
        word_freq = Counter(words)

        # Subject-specific topic keywords with weights
        topic_keywords = {
            'Physical Sciences': {
                'mechanics': ['mechanics', 'motion', 'force', 'newton', 'velocity', 'acceleration', 'momentum', 'energy', 'work', 'power'],
                'waves_sound_light': ['waves', 'sound', 'light', 'optics', 'reflection', 'refraction', 'diffraction', 'interference', 'spectrum'],
                'electricity_magnetism': ['electricity', 'electric', 'circuit', 'current', 'voltage', 'resistance', 'magnetism', 'magnetic', 'ohm', 'ampere'],
                'matter_materials': ['matter', 'materials', 'atomic', 'molecule', 'bonding', 'structure', 'solid', 'liquid', 'gas', 'phase'],
                'chemical_change': ['chemical', 'reaction', 'equilibrium', 'kinetics', 'catalyst', 'stoichiometry', 'mole', 'rate'],
                'chemical_systems': ['acids', 'bases', 'electrochemistry', 'redox', 'galvanic', 'electrolysis', 'salt']
            },
            'Mathematics': {
                'functions': ['functions', 'function', 'domain', 'range', 'inverse', 'logarithm', 'exponential', 'parabola', 'hyperbola'],
                'number_patterns': ['patterns', 'sequence', 'arithmetic', 'geometric', 'series', 'sigma', 'recursive'],
                'finance': ['finance', 'interest', 'compound', 'annuity', 'loan', 'investment', 'depreciation', 'inflation'],
                'algebra': ['algebra', 'equations', 'quadratic', 'simultaneous', 'polynomial', 'factor', 'root'],
                'calculus': ['calculus', 'derivative', 'differentiation', 'integration', 'limit', 'gradient', 'tangent', 'rate of change'],
                'probability': ['probability', 'statistics', 'combinations', 'permutations', 'events', 'outcomes', 'random'],
                'geometry': ['geometry', 'circle', 'triangle', 'polygon', 'congruence', 'similarity', 'theorem', 'pythagoras'],
                'analytical_geometry': ['analytical', 'coordinate', 'gradient', 'midpoint', 'distance', 'line', 'equation of line'],
                'trigonometry': ['trigonometry', 'sine', 'cosine', 'tangent', 'angle', 'triangle', 'identity', 'solving triangles'],
                'statistics': ['statistics', 'data', 'mean', 'median', 'mode', 'standard deviation', 'variance', 'distribution', 'histogram']
            },
            'Mathematical Literacy': {
                'numbers_operations': ['numbers', 'operations', 'percentage', 'ratio', 'proportion', 'fraction', 'decimal'],
                'patterns': ['patterns', 'relationships', 'formula', 'table', 'graph', 'trend'],
                'finance': ['finance', 'budget', 'income', 'expenditure', 'interest', 'tax', 'vat', 'profit', 'loss'],
                'data_handling': ['data', 'graph', 'chart', 'table', 'interpret', 'analyse', 'survey', 'questionnaire'],
                'measurement': ['measurement', 'length', 'area', 'volume', 'mass', 'time', 'temperature', 'scale'],
                'maps_plans': ['maps', 'plans', 'scale', 'direction', 'compass', 'elevation', 'layout'],
                'probability': ['probability', 'chance', 'likelihood', 'risk', 'prediction', 'outcome']
            },
            'Life Sciences': {
                'molecular_cellular': ['cell', 'molecular', 'dna', 'rna', 'protein', 'enzyme', 'mitosis', 'meiosis', 'organelle', 'membrane'],
                'life_processes': ['photosynthesis', 'respiration', 'digestion', 'circulation', 'excretion', 'homeostasis', 'metabolism'],
                'environmental_studies': ['ecosystem', 'biodiversity', 'conservation', 'pollution', 'sustainability', 'climate', 'habitat'],
                'diversity_change': ['evolution', 'natural selection', 'speciation', 'adaptation', 'diversity', 'taxonomy', 'classification']
            },
            'Life Orientation': {
                'personal_wellbeing': ['health', 'wellbeing', 'stress', 'nutrition', 'exercise', 'mental', 'emotional', 'relationships'],
                'citizenship': ['citizenship', 'democracy', 'rights', 'responsibilities', 'constitution', 'values', 'ethics'],
                'careers': ['career', 'work', 'job', 'skills', 'qualifications', 'entrepreneurship', 'employment', 'cv'],
                'social_responsibility': ['social', 'community', 'volunteer', 'service', 'poverty', 'inequality', 'development'],
                'physical_development': ['physical', 'sport', 'fitness', 'recreation', 'movement', 'coordination']
            },
            'Accounting': {
                'financial_accounting': ['financial', 'statement', 'balance sheet', 'income statement', 'assets', 'liabilities', 'equity'],
                'managerial_accounting': ['managerial', 'budget', 'cost', 'variance', 'forecast', 'planning', 'control'],
                'ethics_control': ['ethics', 'internal control', 'fraud', 'governance', 'compliance', 'audit', 'code of conduct'],
                'recording_reporting': ['recording', 'reporting', 'journal', 'ledger', 'trial balance', 'adjustments', 'closing']
            },
            'Business Studies': {
                'business_environment': ['environment', 'macro', 'micro', 'legislation', 'labour', 'competition', 'market'],
                'business_ventures': ['venture', 'entrepreneur', 'business plan', 'startup', 'innovation', 'risk', 'investment'],
                'business_roles': ['roles', 'management', 'leadership', 'human resources', 'recruitment', 'training', 'motivation'],
                'business_operations': ['operations', 'production', 'quality', 'logistics', 'supply chain', 'procurement', 'inventory']
            },
            'Economics': {
                'microeconomics': ['microeconomics', 'demand', 'supply', 'market', 'price', 'elasticity', 'consumer', 'producer'],
                'macroeconomics': ['macroeconomics', 'gdp', 'inflation', 'unemployment', 'fiscal', 'monetary', 'exchange rate'],
                'economic_pursuits': ['pursuits', 'growth', 'development', 'trade', 'globalisation', 'competitiveness', 'productivity'],
                'contemporary_issues': ['contemporary', 'poverty', 'inequality', 'unemployment', 'environment', 'technology', 'future']
            },
            'Geography': {
                'climate_weather': ['climate', 'weather', 'atmosphere', 'pressure', 'precipitation', 'temperature', 'wind', 'cyclone'],
                'geomorphology': ['geomorphology', 'landform', 'erosion', 'weathering', 'river', 'coastal', 'plate tectonics', 'earthquake'],
                'population': ['population', 'demographics', 'migration', 'urbanisation', 'settlement', 'density', 'growth'],
                'development': ['development', 'underdevelopment', 'inequality', 'poverty', 'sustainability', 'resources', 'planning'],
                'resources_sustainability': ['resources', 'sustainability', 'conservation', 'renewable', 'energy', 'water', 'soil', 'biodiversity']
            },
            'Agricultural Sciences': {
                'animal_production': ['animal', 'livestock', 'cattle', 'sheep', 'poultry', 'breeding', 'nutrition', 'health', 'welfare'],
                'plant_production': ['plant', 'crop', 'cultivation', 'harvest', 'seed', 'fertiliser', 'pest', 'disease', 'irrigation'],
                'agricultural_management': ['management', 'farm', 'planning', 'budget', 'marketing', 'record', 'enterprise', 'risk'],
                'soil_science': ['soil', 'fertility', 'texture', 'structure', 'ph', 'nutrient', 'erosion', 'conservation', 'compost']
            }
        }

        keywords = topic_keywords.get(subject, {})
        topics = []

        for topic_name, keywords_list in keywords.items():
            score = 0
            matched_keywords = []
            for kw in keywords_list:
                count = word_freq.get(kw, 0)
                if count > 0:
                    score += count
                    matched_keywords.append(kw)

            # Threshold: at least 2 different keywords or score >= 3
            if len(matched_keywords) >= 2 or score >= 3:
                topics.append({
                    'topic_name': topic_name.replace('_', ' ').title(),
                    'score': score,
                    'keywords_found': matched_keywords,
                    'confidence': 'high' if score >= 5 else 'medium'
                })

        # Sort by score descending
        topics.sort(key=lambda x: x['score'], reverse=True)
        return topics

    def extract_structure(self, pdf_path, subject, max_pages=15):
        print(f"\n{'='*60}")
        print(f"Extracting: {Path(pdf_path).name}")
        print(f"Subject: {subject}")
        print(f"{'='*60}")

        full_text = self.extract_all_pages(pdf_path, max_pages=max_pages)
        topics = self.identify_topics_smart(full_text, subject)

        result = {
            'pdf_path': str(pdf_path),
            'subject': subject,
            'text_sample': full_text[:3000],
            'identified_topics': topics,
            'extraction_method': 'Smart (PyMuPDF + keyword frequency)'
        }

        print(f"\nTopics identified: {len(topics)}")
        for t in topics:
            print(f"  ✓ {t['topic_name']} (score: {t['score']}, confidence: {t['confidence']})")
            if t['keywords_found']:
                print(f"    Keywords: {', '.join(t['keywords_found'][:5])}")

        return result


def main():
    base_dir = r"C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents"
    pdf_dir = Path(base_dir)

    if not pdf_dir.exists():
        print(f"⚠ Directory not found: {base_dir}")
        sys.exit(1)

    pdf_files = []
    for pdf_file in pdf_dir.glob("*.pdf"):
        fname = pdf_file.name.upper()
        subject = None
        skip = False

        if 'AMENDMENTS' in fname or 'AMENDED' in fname or 'ART SUBJECTS' in fname or 'FET CAP DRAFT' in fname or 'SECTION 4' in fname or 'CAPS MAPPING' in fname:
            skip = True
        elif 'PHYSICAL' in fname:
            subject = 'Physical Sciences'
        elif 'LIFE ORIENTATION' in fname:
            subject = 'Life Orientation'
        elif 'LIFE SCIENCE' in fname:
            subject = 'Life Sciences'
        elif 'MATHEMATICAL LITERACY' in fname:
            subject = 'Mathematical Literacy'
        elif 'MATHEMATICS' in fname:
            subject = 'Mathematics'
        elif 'ACCOUNTING' in fname:
            subject = 'Accounting'
        elif 'BUSINESS' in fname:
            subject = 'Business Studies'
        elif 'ECONOMICS' in fname:
            subject = 'Economics'
        elif 'GEOGRAPHY' in fname:
            subject = 'Geography'
        elif 'AGRICULTURAL' in fname:
            subject = 'Agricultural Sciences'
        elif 'HISTORY' in fname:
            subject = 'History'
        elif 'TOURISM' in fname:
            subject = 'Tourism'
        elif 'TECHNICAL' in fname and 'MATH' in fname:
            subject = 'Technical Mathematics'
        elif 'TECHNICAL' in fname and 'SCIENCE' in fname:
            subject = 'Technical Sciences'

        if skip:
            print(f"Skip: {pdf_file.name}")
        elif subject:
            pdf_files.append((str(pdf_file), subject))
            print(f"Found: {pdf_file.name} → {subject}")
        else:
            print(f"Unmatched: {pdf_file.name}")

    if not pdf_files:
        print("⚠ No valid CAPS PDFs found")
        sys.exit(1)

    print(f"\nTotal PDFs to process: {len(pdf_files)}")

    extractor = SmartCapsExtractor(use_gpu=False)
    all_results = []

    for pdf_path, subject in pdf_files:
        result = extractor.extract_structure(pdf_path, subject, max_pages=15)
        all_results.append(result)

    with open("caps_smart_extraction.json", 'w', encoding='utf-8') as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Results saved to: caps_smart_extraction.json")

    generate_seed_sql(all_results)


def generate_seed_sql(results):
    print(f"\n{'='*60}")
    print("GENERATING SQL SEED STATEMENTS")
    print(f"{'='*60}")

    sql_lines = ["-- CAPS Topics Seed Data (Smart extraction)", ""]

    for result in results:
        subject = result['subject']
        topics = result['identified_topics']

        sql_lines.append(f"-- Subject: {subject}")
        for topic in topics:
            topic_name = topic['topic_name'].replace("'", "''")
            sql_lines.append(f"INSERT INTO lookup_caps_topics (subject_official_code, topic_name, description, created_at)")
            sql_lines.append(f"SELECT ls.subject_official_code, '{topic_name}', 'CAPS topic: {topic_name}', NOW()")
            sql_lines.append(f"FROM lookup_subjects ls WHERE ls.name = '{subject}' LIMIT 1;")
        sql_lines.append("")

    with open("caps_topics_seed.sql", 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_lines))

    print(f"✓ SQL seed file: caps_topics_seed.sql")
    print(f"\nTotal topics to seed: {sum(len(r['identified_topics']) for r in results)}")


if __name__ == "__main__":
    main()
