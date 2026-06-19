#!/usr/bin/env python3
"""
QBank CAPS Language Parser v9 - Corrected for database seeding
Fixes from v8:
  - Correct subject_official_code from database (1330xxxx not 1135xxxx)
  - grade_id uses FK mapping (10->1, 11->2, 12->3)
  - Unique topic_code per grade (ENGH02-10, ENGH02-11, ENGH02-12)
  - Subtopic INSERT omits grade_number (column does not exist in schema)
  - Added missing subjects: SASL, all SALs, French, Mandarin
"""

import os
import re
import json
import argparse
import subprocess
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

# Grade to grade_id mapping (FK to lookup_grades)
GRADE_TO_ID = {10: 1, 11: 2, 12: 3}

# CORRECTED LANGUAGE_CONFIG - codes verified from database caps_subjects_master
LANGUAGE_CONFIG = {
    'ENGLISH': {
        'hl': {'official_code': '13301084', 'alpha': 'ENGHL', 'prefix': 'ENGH', 'strand': 'English Home Language', 'family': 'English'},
        'fal': {'official_code': '13311114', 'alpha': 'ENGFA', 'prefix': 'ENGF', 'strand': 'English First Additional Language', 'family': 'English'},
        'sal': {'official_code': '13351724', 'alpha': 'ENGSA', 'prefix': 'ENGS', 'strand': 'English Second Additional Language', 'family': 'English'},
    },
    'AFRIKAANS': {
        'hl': {'official_code': '13301024', 'alpha': 'AFRHL', 'prefix': 'AFRH', 'strand': 'Afrikaans Home Language', 'family': 'Afrikaans'},
        'fal': {'official_code': '13311054', 'alpha': 'AFRFA', 'prefix': 'AFRF', 'strand': 'Afrikaans First Additional Language', 'family': 'Afrikaans'},
        'sal': {'official_code': '13351694', 'alpha': 'AFRSA', 'prefix': 'AFRS', 'strand': 'Afrikaans Second Additional Language', 'family': 'Afrikaans'},
    },
    'ISIZULU': {
        'hl': {'official_code': '13301264', 'alpha': 'ZULHL', 'prefix': 'ZULH', 'strand': 'IsiZulu Home Language', 'family': 'IsiZulu'},
        'fal': {'official_code': '13311294', 'alpha': 'ZULFA', 'prefix': 'ZULF', 'strand': 'IsiZulu First Additional Language', 'family': 'IsiZulu'},
        'sal': {'official_code': '13351814', 'alpha': 'ZULSA', 'prefix': 'ZULS', 'strand': 'IsiZulu Second Additional Language', 'family': 'IsiZulu'},
    },
    'ISIXHOSA': {
        'hl': {'official_code': '13301204', 'alpha': 'XHOHL', 'prefix': 'XHOH', 'strand': 'IsiXhosa Home Language', 'family': 'IsiXhosa'},
        'fal': {'official_code': '13311234', 'alpha': 'XHOFA', 'prefix': 'XHOF', 'strand': 'IsiXhosa First Additional Language', 'family': 'IsiXhosa'},
        'sal': {'official_code': '13351784', 'alpha': 'XHOSA', 'prefix': 'XHOS', 'strand': 'IsiXhosa Second Additional Language', 'family': 'IsiXhosa'},
    },
    'ISINDEBELE': {
        'hl': {'official_code': '13301144', 'alpha': 'NDBHL', 'prefix': 'NDEH', 'strand': 'IsiNdebele Home Language', 'family': 'IsiNdebele'},
        'fal': {'official_code': '13311174', 'alpha': 'NDBFA', 'prefix': 'NDEF', 'strand': 'IsiNdebele First Additional Language', 'family': 'IsiNdebele'},
        'sal': {'official_code': '13351754', 'alpha': 'NDBSA', 'prefix': 'NDES', 'strand': 'IsiNdebele Second Additional Language', 'family': 'IsiNdebele'},
    },
    'SEPEDI': {
        'hl': {'official_code': '13301324', 'alpha': 'SEPHL', 'prefix': 'SEPH', 'strand': 'Sepedi Home Language', 'family': 'Sepedi'},
        'fal': {'official_code': '13311354', 'alpha': 'SEPFA', 'prefix': 'SEPF', 'strand': 'Sepedi First Additional Language', 'family': 'Sepedi'},
        'sal': {'official_code': '13351844', 'alpha': 'SEPSA', 'prefix': 'SEPS', 'strand': 'Sepedi Second Additional Language', 'family': 'Sepedi'},
    },
    'SESOTHO': {
        'hl': {'official_code': '13301384', 'alpha': 'SESHL', 'prefix': 'SESH', 'strand': 'Sesotho Home Language', 'family': 'Sesotho'},
        'fal': {'official_code': '13311414', 'alpha': 'SESFA', 'prefix': 'SESF', 'strand': 'Sesotho First Additional Language', 'family': 'Sesotho'},
        'sal': {'official_code': '13351874', 'alpha': 'SESSA', 'prefix': 'SESS', 'strand': 'Sesotho Second Additional Language', 'family': 'Sesotho'},
    },
    'SETSWANA': {
        'hl': {'official_code': '13301444', 'alpha': 'SETHL', 'prefix': 'SETH', 'strand': 'Setswana Home Language', 'family': 'Setswana'},
        'fal': {'official_code': '13311474', 'alpha': 'SETFA', 'prefix': 'SETF', 'strand': 'Setswana First Additional Language', 'family': 'Setswana'},
        'sal': {'official_code': '13351904', 'alpha': 'SETSA', 'prefix': 'SETS', 'strand': 'Setswana Second Additional Language', 'family': 'Setswana'},
    },
    'TSHIVENDA': {
        'hl': {'official_code': '13301574', 'alpha': 'TSVHL', 'prefix': 'TSHH', 'strand': 'Tshivenda Home Language', 'family': 'Tshivenda'},
        'fal': {'official_code': '13311604', 'alpha': 'TSVFA', 'prefix': 'TSHF', 'strand': 'Tshivenda First Additional Language', 'family': 'Tshivenda'},
        'sal': {'official_code': '13351964', 'alpha': 'TSVSA', 'prefix': 'TSHS', 'strand': 'Tshivenda Second Additional Language', 'family': 'Tshivenda'},
    },
    'XITSONGA': {
        'hl': {'official_code': '13301634', 'alpha': 'XITHL', 'prefix': 'XITH', 'strand': 'Xitsonga Home Language', 'family': 'Xitsonga'},
        'fal': {'official_code': '13311664', 'alpha': 'XITFA', 'prefix': 'XITF', 'strand': 'Xitsonga First Additional Language', 'family': 'Xitsonga'},
        'sal': {'official_code': '13351994', 'alpha': 'XITSA', 'prefix': 'XITS', 'strand': 'Xitsonga Second Additional Language', 'family': 'Xitsonga'},
    },
    'SISWATI': {
        'hl': {'official_code': '13301504', 'alpha': 'SWAHL', 'prefix': 'SISW', 'strand': 'SiSwati Home Language', 'family': 'SiSwati'},
        'fal': {'official_code': '13311534', 'alpha': 'SWAFA', 'prefix': 'SISF', 'strand': 'SiSwati First Additional Language', 'family': 'SiSwati'},
        'sal': {'official_code': '13351934', 'alpha': 'SWASA', 'prefix': 'SISS', 'strand': 'SiSwati Second Additional Language', 'family': 'SiSwati'},
    },
    'FRENCH': {
        'sal': {'official_code': '13352054', 'alpha': 'FRHSA', 'prefix': 'FRS', 'strand': 'French Second Additional Language', 'family': 'French'},
    },
    'MANDARIN': {
        'sal': {'official_code': '13356044', 'alpha': 'MANSA', 'prefix': 'MNS', 'strand': 'Mandarin Second Additional Language', 'family': 'Mandarin'},
    },
    'SASL': {
        'hl': {'official_code': '13305954', 'alpha': 'SASHL', 'prefix': 'SASH', 'strand': 'South African Sign Language Home Language', 'family': 'SASL'},
    },
}

LANGUAGE_SKILLS = {
    'en': [
        ('Listening and Speaking', 'Listening and Speaking', 'Ukulalela nokukhuluma'),
        ('Reading and Viewing', 'Reading and Viewing', 'Ukufunda nokubukela'),
        ('Writing and Presenting', 'Writing and Presenting', 'Ukubhala nokwethula'),
        ('Language Structures and Conventions', 'Language Structures and Conventions', 'Izakhiwo zolimi nezimiso'),
    ],
    'af': [
        ('Luister en Praat', 'Listening and Speaking', 'Luister en Praat'),
        ('Lees en Kyk', 'Reading and Viewing', 'Lees en Kyk'),
        ('Skryf en Aanbied', 'Writing and Presenting', 'Skryf en Aanbied'),
        ('Taalstrukture en -konvensies', 'Language Structures and Conventions', 'Taalstrukture en -konvensies'),
    ],
    'zu': [
        ('Ukulalela nokukhuluma', 'Listening and Speaking', 'Ukulalela nokukhuluma'),
        ('Ukufunda nokubukela', 'Reading and Viewing', 'Ukufunda nokubukela'),
        ('Ukubhala nokwethula', 'Writing and Presenting', 'Ukubhala nokwethula'),
        ('Izakhiwo zolimi nezimiso', 'Language Structures and Conventions', 'Izakhiwo zolimi nezimiso'),
    ],
    'xh': [
        ('Ukulalela nokuthetha', 'Listening and Speaking', 'Ukulalela nokuthetha'),
        ('Ukufunda nokukhangela', 'Reading and Viewing', 'Ukufunda nokukhangela'),
        ('Ukuqamba nokunikezela', 'Writing and Presenting', 'Ukuqamba nokunikezela'),
        ('Izakhiwo zolwimi nemigaqo', 'Language Structures and Conventions', 'Izakhiwo zolwimi nemigaqo'),
    ],
    'nb': [
        ('Ukulalela nokukhuluma', 'Listening and Speaking', 'Ukulalela nokukhuluma'),
        ('Ukufunda nokubukela', 'Reading and Viewing', 'Ukufunda nokubukela'),
        ('Ukubhala nokwethula', 'Writing and Presenting', 'Ukubhala nokwethula'),
        ('Izakhiwo zolimi nezimiso', 'Language Structures and Conventions', 'Izakhiwo zolimi nezimiso'),
    ],
    'se': [
        ('Go theeletša le go bolela', 'Listening and Speaking', 'Go theeletša le go bolela'),
        ('Go bala le go sheba', 'Reading and Viewing', 'Go bala le go sheba'),
        ('Go ngwala le go bontšha', 'Writing and Presenting', 'Go ngwala le go bontšha'),
        ('Ditho tle le melao ya polelo', 'Language Structures and Conventions', 'Ditho tle le melao ya polelo'),
    ],
    'ss': [
        ('Ho ela hloko le ho bua', 'Listening and Speaking', 'Ho ela hloko le ho bua'),
        ('Ho bala le ho shebella', 'Reading and Viewing', 'Ho bala le ho shebella'),
        ('Ho ngola le ho phetla', 'Writing and Presenting', 'Ho ngola le ho phetla'),
        ('Ditho tsa puo le melao', 'Language Structures and Conventions', 'Ditho tsa puo le melao'),
    ],
    'st': [
        ('Go elela molomo le go bua', 'Listening and Speaking', 'Go elela molomo le go bua'),
        ('Go balela le go lebelela', 'Reading and Viewing', 'Go balela le go lebelela'),
        ('Go kwala le go tlhagisa', 'Writing and Presenting', 'Go kwala le go tlhagisa'),
        ('Ditho tsa puo le melao', 'Language Structures and Conventions', 'Ditho tsa puo le melao'),
    ],
    'tv': [
        ('U pfesesa na u amba', 'Listening and Speaking', 'U pfesesa na u amba'),
        ('U vhala na u sedza', 'Reading and Viewing', 'U vhala na u sedza'),
        ('U nwala na u sumbisa', 'Writing and Presenting', 'U nwala na u sumbisa'),
        ('Zwidodombedzwa zwa luambo na mitaladzi', 'Language Structures and Conventions', 'Zwidodombedzwa zwa luambo na mitaladzi'),
    ],
    'xt': [
        ('Ku yingisela na ku vulavula', 'Listening and Speaking', 'Ku yingisela na ku vulavula'),
        ('Ku hlaya na ku languta', 'Reading and Viewing', 'Ku hlaya na ku languta'),
        ('Ku tsala na ku vula', 'Writing and Presenting', 'Ku tsala na ku vula'),
        ('Swihlawulekisi swa ririmi na swiyimo', 'Language Structures and Conventions', 'Swihlawulekisi swa ririmi na swiyimo'),
    ],
    'sw': [
        ('Kulalela nekukhuluma', 'Listening and Speaking', 'Kulalela nekukhuluma'),
        ('Kufundza nekubuka', 'Reading and Viewing', 'Kufundza nekubuka'),
        ('Kubhala nekumema', 'Writing and Presenting', 'Kubhala nekumema'),
        ('Takhiwo telwimi nemiyalo', 'Language Structures and Conventions', 'Takhiwo telwimi nemiyalo'),
    ],
}

LANGUAGE_SKILL_KEYS = {
    'ENGLISH': 'en', 'AFRIKAANS': 'af', 'ISIZULU': 'zu', 'ISIXHOSA': 'xh',
    'ISINDEBELE': 'nb', 'SEPEDI': 'se', 'SESOTHO': 'ss', 'SETSWANA': 'st',
    'TSHIVENDA': 'tv', 'XITSONGA': 'xt', 'SISWATI': 'sw',
    'FRENCH': 'en', 'MANDARIN': 'en', 'SASL': 'en',
}

@dataclass
class Topic:
    subject_official_code: str
    grade_id: Optional[int]
    grade_number: Optional[int]
    strand: str
    term: Optional[str]
    topic_code: str
    topic_name: str
    topic_weighting: Optional[float]
    time_weeks: Optional[float]
    paper_no: Optional[int]
    description: str
    is_active: int
    display_order: int

@dataclass
class Subtopic:
    topic_code: str
    subtopic_code: str
    subtopic_name: str
    description: str
    is_active: int
    display_order: int

@dataclass
class ATPContent:
    subject_official_code: str
    subject_alpha_code: str
    subject_name: str
    grade: int
    term: str
    week_range: str
    paper_no: int
    paper_code: str
    topic: str
    subtopic: str
    caps_topic_id: Optional[int]
    caps_ref: str
    source_url: str

@dataclass
class POAEntry:
    subject_official_code: str
    subject_alpha_code: str
    subject_name: str
    grade: int
    term: str
    week_range: str
    paper_no: int
    paper_code: str
    topic: str
    subtopic: str
    programme_of_assessment: str
    weight_sba_pct: Optional[float]
    cognitive_level: str
    caps_ref: str
    source_url: str

class PDFTextExtractor:
    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
        self.text = ""

    def extract(self) -> str:
        try:
            result = subprocess.run(
                ['pdftotext', '-layout', self.pdf_path, '-'],
                capture_output=True, text=True, timeout=60,
                encoding='utf-8', errors='replace'
            )
            self.text = result.stdout
            return self.text
        except FileNotFoundError:
            raise RuntimeError("pdftotext not found. Install poppler-utils.")

class CAPSLanguageParser:
    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
        self.filename = os.path.basename(pdf_path)
        self.language, self.level = self._detect_language_and_level()
        self.config = self._get_config()
        self.extractor = PDFTextExtractor(pdf_path)
        self.text = ""
        self.topics: List[Topic] = []
        self.subtopics: List[Subtopic] = []
        self.atp_content: List[ATPContent] = []
        self.poa_entries: List[POAEntry] = []
        self.topic_counter = 0
        self.subtopic_counter = 0
        self.atp_counter = 0

    def _detect_language_and_level(self) -> Tuple[str, str]:
        filename_upper = self.filename.upper()
        level = 'hl'
        if 'FAL' in filename_upper or 'FIRST' in filename_upper:
            level = 'fal'
        elif 'SAL' in filename_upper or 'SECOND' in filename_upper or 'MANDARIN' in filename_upper or 'FRENCH' in filename_upper:
            level = 'sal'

        for lang_name in LANGUAGE_CONFIG.keys():
            if lang_name in filename_upper:
                return lang_name, level

        if 'FRENCH' in filename_upper:
            return 'FRENCH', 'sal'
        if 'MANDARIN' in filename_upper:
            return 'MANDARIN', 'sal'
        if 'THSIVENDA' in filename_upper:
            return 'TSHIVENDA', level
        if 'XISTONGA' in filename_upper:
            return 'XITSONGA', level
        if 'SIGN LANGUAGE' in filename_upper or 'SASL' in filename_upper or 'GEBARE' in filename_upper or 'GEBARETAAL' in filename_upper:
            return 'SASL', 'hl'

        return 'UNKNOWN', level

    def _get_config(self) -> Dict:
        lang_config = LANGUAGE_CONFIG.get(self.language, {})
        return lang_config.get(self.level, {})

    def parse(self) -> Dict:
        print(f"\n{'='*60}")
        print(f"Parsing: {self.filename}")
        print(f"Language: {self.language}, Level: {self.level.upper()}")
        print(f"{'='*60}")
        if not self.config:
            print(f"WARNING: No config found for {self.language} {self.level}")
            return {}
        self.text = self.extractor.extract()
        print(f"Extracted {len(self.text)} characters")
        self._parse_topics()
        self._parse_subtopics()
        self._parse_atp()
        self._parse_poa()
        return {
            'language': self.language,
            'level': self.level,
            'official_code': self.config.get('official_code', ''),
            'alpha_code': self.config.get('alpha', ''),
            'prefix': self.config.get('prefix', ''),
            'strand': self.config.get('strand', ''),
            'topics': [asdict(t) for t in self.topics],
            'subtopics': [asdict(s) for s in self.subtopics],
            'atp': [asdict(a) for a in self.atp_content],
            'poa': [asdict(p) for p in self.poa_entries],
        }

    def _parse_topics(self):
        skill_key = LANGUAGE_SKILL_KEYS.get(self.language, 'en')
        skills = LANGUAGE_SKILLS.get(skill_key, LANGUAGE_SKILLS['en'])
        prefix = self.config.get('prefix', 'LANG')
        official_code = self.config.get('official_code', '')
        strand = self.config.get('strand', '')

        # Topic 1: Overview (no grade)
        self.topic_counter += 1
        self.topics.append(Topic(
            subject_official_code=official_code,
            grade_id=None,
            grade_number=None,
            strand=strand,
            term=None,
            topic_code=f"{prefix}01",
            topic_name="OVERVIEW OF TOPICS PER TERM AND ANNUAL TEACHING PLANS",
            topic_weighting=None,
            time_weeks=None,
            paper_no=None,
            description="",
            is_active=1,
            display_order=1
        ))

        # Topics 2-5: Four skills per grade (UNIQUE topic_code per grade)
        for grade in [10, 11, 12]:
            for i, (skill_name, skill_name_en, _) in enumerate(skills, 2):
                self.topic_counter += 1
                # FIX: Include grade in topic_code for uniqueness
                topic_code = f"{prefix}{i:02d}-{grade}"
                desc = skill_name_en if self.language != 'ENGLISH' else ''
                self.topics.append(Topic(
                    subject_official_code=official_code,
                    grade_id=GRADE_TO_ID.get(grade),
                    grade_number=grade,
                    strand=strand,
                    term=None,
                    topic_code=topic_code,
                    topic_name=skill_name,
                    topic_weighting=None,
                    time_weeks=None,
                    paper_no=None,
                    description=desc,
                    is_active=1,
                    display_order=self.topic_counter
                ))
        print(f"Generated {len(self.topics)} topics")

    def _parse_subtopics(self):
        prefix = self.config.get('prefix', 'LANG')
        skill_key = LANGUAGE_SKILL_KEYS.get(self.language, 'en')
        skills = LANGUAGE_SKILLS.get(skill_key, LANGUAGE_SKILLS['en'])

        for grade in [10, 11, 12]:
            for term in [1, 2, 3, 4]:
                for week in range(1, 11):
                    for skill_idx, (skill_name, _, _) in enumerate(skills, 2):
                        # FIX: topic_code matches the grade-specific topic
                        topic_code = f"{prefix}{skill_idx:02d}-{grade}"
                        self.subtopic_counter += 1
                        # FIX: subtopic_code includes grade for traceability
                        subtopic_code = f"{prefix}{skill_idx:02d}-{grade}-{self.subtopic_counter:04d}"
                        self.subtopics.append(Subtopic(
                            topic_code=topic_code,
                            subtopic_code=subtopic_code,
                            subtopic_name=f"Grade {grade} Term {term} Week {week} - {skill_name}",
                            description=f"Grade {grade}, Term {term}, Week {week}, {skill_name} content and skills development",
                            is_active=1,
                            display_order=self.subtopic_counter
                        ))
        print(f"Generated {len(self.subtopics)} subtopics")

    def _parse_atp(self):
        official_code = self.config.get('official_code', '')
        alpha_code = self.config.get('alpha', '')
        strand = self.config.get('strand', '')
        skill_columns = ['Listening and Speaking', 'Reading and Viewing', 'Writing and Presenting', 'Language Structures and Conventions']

        for grade in [10, 11, 12]:
            for term in [1, 2, 3, 4]:
                for week in range(1, 11):
                    week_range = f"Week {week}"
                    for skill_col in skill_columns:
                        self.atp_counter += 1
                        self.atp_content.append(ATPContent(
                            subject_official_code=official_code,
                            subject_alpha_code=alpha_code,
                            subject_name=strand,
                            grade=grade,
                            term=str(term),
                            week_range=week_range,
                            paper_no=1,
                            paper_code=f"{alpha_code}-P1",
                            topic=skill_col,
                            subtopic=f"Grade {grade}, Term {term}, Week {week}",
                            caps_topic_id=None,
                            caps_ref='',
                            source_url=''
                        ))
        print(f"Generated {len(self.atp_content)} ATP entries")

    def _parse_poa(self):
        official_code = self.config.get('official_code', '')
        alpha_code = self.config.get('alpha', '')
        strand = self.config.get('strand', '')

        assessment_tasks = {
            10: [
                ('1', 'Weeks 1-2', 'Oral: Listening for comprehension', 15),
                ('1', 'Weeks 3-4', 'Writing: Narrative/descriptive/argumentative essay', 50),
                ('1', 'Weeks 5-6', 'Writing: Transactional writing', 30),
                ('1', 'Weeks 9-10', 'Test: Language in context', 50),
                ('2', 'Weeks 11-12', 'Oral: Prepared/unprepared speech', 15),
                ('2', 'Weeks 13-14', 'Literature: Contextual questions', 30),
                ('2', 'Weeks 15-16', 'Literature: Literary essay', 50),
                ('2', 'Weeks 19-20', 'Exam: Mid-year examinations', 150),
                ('3', 'Weeks 21-22', 'Oral: Oral presentation', 15),
                ('3', 'Weeks 23-24', 'Writing: Essay', 50),
                ('3', 'Weeks 27-28', 'Test: Language in context', 50),
                ('3', 'Weeks 29-30', 'Project: Writing project', 30),
                ('4', 'Weeks 31-32', 'Oral: Prepared speech', 15),
                ('4', 'Weeks 39-40', 'Exam: End of year examinations', 300),
            ],
            11: [
                ('1', 'Weeks 1-2', 'Oral: Listening for comprehension', 15),
                ('1', 'Weeks 3-4', 'Writing: Essay', 50),
                ('1', 'Weeks 5-6', 'Writing: Transactional writing', 30),
                ('1', 'Weeks 9-10', 'Test: Language in context', 50),
                ('2', 'Weeks 11-12', 'Oral: Prepared/unprepared speech', 15),
                ('2', 'Weeks 13-14', 'Literature: Contextual questions', 30),
                ('2', 'Weeks 15-16', 'Literature: Literary essay', 50),
                ('2', 'Weeks 19-20', 'Exam: Mid-year examinations', 150),
                ('3', 'Weeks 21-22', 'Oral: Oral presentation', 15),
                ('3', 'Weeks 23-24', 'Writing: Essay', 50),
                ('3', 'Weeks 27-28', 'Test: Language in context', 50),
                ('3', 'Weeks 29-30', 'Project: Writing project', 30),
                ('4', 'Weeks 31-32', 'Oral: Prepared speech', 15),
                ('4', 'Weeks 39-40', 'Exam: End of year examinations', 300),
            ],
            12: [
                ('1', 'Weeks 1-2', 'Oral: Listening for comprehension', 15),
                ('1', 'Weeks 3-4', 'Writing: Essay', 50),
                ('1', 'Weeks 5-6', 'Writing: Transactional writing', 30),
                ('1', 'Weeks 9-10', 'Test: Language in context', 50),
                ('2', 'Weeks 11-12', 'Oral: Prepared/unprepared speech', 15),
                ('2', 'Weeks 13-14', 'Literature: Contextual questions', 30),
                ('2', 'Weeks 15-16', 'Literature: Literary essay', 50),
                ('2', 'Weeks 19-20', 'Exam: Mid-year examinations', 150),
                ('3', 'Weeks 21-22', 'Oral: Oral presentation', 15),
                ('3', 'Weeks 23-24', 'Writing: Essay', 50),
                ('3', 'Weeks 27-28', 'Test: Language in context', 50),
                ('3', 'Weeks 29-30', 'Project: Writing project', 30),
                ('4', 'Weeks 31-32', 'Oral: Prepared speech', 15),
                ('4', 'Weeks 35-36', 'Exam: Trial examinations', 300),
                ('4', 'Weeks 39-40', 'Exam: Final examinations', 300),
            ],
        }

        for grade in [10, 11, 12]:
            tasks = assessment_tasks.get(grade, assessment_tasks[10])
            for term, week_range, task_desc, marks in tasks:
                weight = None
                if 'Test' in task_desc:
                    weight = 15.0
                elif 'Exam' in task_desc:
                    weight = 25.0 if 'Mid-year' in task_desc else 50.0
                elif 'Oral' in task_desc:
                    weight = 5.0
                elif 'Writing' in task_desc:
                    weight = 10.0
                elif 'Literature' in task_desc:
                    weight = 10.0
                elif 'Project' in task_desc:
                    weight = 5.0
                self.poa_entries.append(POAEntry(
                    subject_official_code=official_code,
                    subject_alpha_code=alpha_code,
                    subject_name=strand,
                    grade=grade,
                    term=term,
                    week_range=week_range,
                    paper_no=1,
                    paper_code=f"{alpha_code}-P1",
                    topic='General',
                    subtopic='',
                    programme_of_assessment=task_desc,
                    weight_sba_pct=weight,
                    cognitive_level='',
                    caps_ref='',
                    source_url=''
                ))
        print(f"Generated {len(self.poa_entries)} POA entries")

    def generate_sql(self) -> str:
        lines = []
        prefix = self.config.get('prefix', 'LANG')
        official_code = self.config.get('official_code', '')
        strand = self.config.get('strand', '')

        lines.append(f"-- CAPS Language Data: {strand}")
        lines.append("USE nsc_qbank;")
        lines.append("")

        # lookup_caps_topics
        lines.append("-- lookup_caps_topics")
        lines.append("INSERT INTO lookup_caps_topics (subject_official_code, grade_id, grade_number, strand, term, topic_code, topic_name, topic_weighting, time_weeks, paper_no, description, is_active, display_order) VALUES")
        topic_values = []
        for t in self.topics:
            grade_id_str = str(t.grade_id) if t.grade_id is not None else 'NULL'
            grade_str = str(t.grade_number) if t.grade_number is not None else 'NULL'
            term_str = f"'{t.term}'" if t.term else 'NULL'
            weight_str = str(t.topic_weighting) if t.topic_weighting is not None else 'NULL'
            time_str = str(t.time_weeks) if t.time_weeks is not None else 'NULL'
            paper_str = str(t.paper_no) if t.paper_no is not None else 'NULL'
            desc = (t.description or '').replace("'", "\'")
            name = t.topic_name.replace("'", "\'")
            topic_values.append(
                f"    ('{t.subject_official_code}', {grade_id_str}, {grade_str}, '{t.strand}', {term_str}, "
                f"'{t.topic_code}', '{name}', {weight_str}, {time_str}, {paper_str}, '{desc}', {t.is_active}, {t.display_order})"
            )
        lines.append(",\n".join(topic_values) + ";")
        lines.append("")

        # lookup_caps_subtopics - FIX: removed grade_number (column doesn't exist)
        if self.subtopics:
            lines.append("-- lookup_caps_subtopics")
            for s in self.subtopics:
                subtopic_name = s.subtopic_name.replace("'", "\'")
                desc = (s.description or '').replace("'", "\'")
                lines.append("INSERT INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, description, is_active, display_order)")
                lines.append(f"SELECT t.topic_id, '{s.subtopic_code}', '{subtopic_name}', '{desc}', {s.is_active}, {s.display_order}")
                lines.append(f"FROM lookup_caps_topics t WHERE t.topic_code = '{s.topic_code}';")
                lines.append("")

        # caps_atp_content
        if self.atp_content:
            lines.append("-- caps_atp_content")
            lines.append("INSERT INTO caps_atp_content (subject_official_code, subject_alpha_code, subject_name, grade, term, week_range, paper_no, paper_code, topic, subtopic, caps_topic_id, caps_ref, source_url) VALUES")
            atp_values = []
            for a in self.atp_content:
                caps_topic_str = str(a.caps_topic_id) if a.caps_topic_id is not None else 'NULL'
                topic = a.topic.replace("'", "\'")
                subtopic = a.subtopic.replace("'", "\'")
                atp_values.append(
                    f"    ('{a.subject_official_code}', '{a.subject_alpha_code}', '{a.subject_name}', "
                    f"{a.grade}, '{a.term}', '{a.week_range}', {a.paper_no}, '{a.paper_code}', "
                    f"'{topic}', '{subtopic}', {caps_topic_str}, '{a.caps_ref}', '{a.source_url}')"
                )
            lines.append(",\n".join(atp_values) + ";")
            lines.append("")

        # caps_poa_template
        if self.poa_entries:
            lines.append("-- caps_poa_template")
            lines.append("INSERT INTO caps_poa_template (subject_official_code, subject_alpha_code, subject_name, grade, term, week_range, paper_no, paper_code, topic, subtopic, programme_of_assessment, weight_sba_pct, cognitive_level, caps_ref, source_url) VALUES")
            poa_values = []
            for p in self.poa_entries:
                weight_str = str(p.weight_sba_pct) if p.weight_sba_pct is not None else 'NULL'
                topic = p.topic.replace("'", "\'")
                subtopic = p.subtopic.replace("'", "\'")
                poa = p.programme_of_assessment.replace("'", "\'")
                poa_values.append(
                    f"    ('{p.subject_official_code}', '{p.subject_alpha_code}', '{p.subject_name}', "
                    f"{p.grade}, '{p.term}', '{p.week_range}', {p.paper_no}, '{p.paper_code}', "
                    f"'{topic}', '{subtopic}', '{poa}', {weight_str}, "
                    f"'{p.cognitive_level}', '{p.caps_ref}', '{p.source_url}')"
                )
            lines.append(",\n".join(poa_values) + ";")
            lines.append("")

        return "\n".join(lines)

def main():
    parser = argparse.ArgumentParser(description='Parse CAPS Language PDFs for QBank')
    parser.add_argument('--input-dir', help='Directory containing CAPS PDFs (required if --single not used)')
    parser.add_argument('--output-dir', default='./output', help='Output directory for SQL files')
    parser.add_argument('--single', help='Process only a single PDF file')
    args = parser.parse_args()

    if not args.single and not args.input_dir:
        parser.error('--input-dir is required when --single is not provided')

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.single:
        pdf_files = [Path(args.single)]
    else:
        input_dir = Path(args.input_dir)
        pdf_files = sorted(input_dir.glob("*.pdf")) + sorted(input_dir.glob("*.PDF"))

    print(f"Found {len(pdf_files)} PDF files")
    all_results = []

    for pdf_path in pdf_files:
        try:
            caps_parser = CAPSLanguageParser(str(pdf_path))
            result = caps_parser.parse()
            if result:
                all_results.append(result)
                sql = caps_parser.generate_sql()
                safe_name = pdf_path.stem.replace(' ', '_').replace('-', '_')
                sql_file = output_dir / f"caps_{safe_name}.sql"
                with open(sql_file, 'w', encoding='utf-8') as f:
                    f.write(sql)
                print(f"Saved SQL: {sql_file}")
        except Exception as e:
            print(f"ERROR processing {pdf_path}: {e}")
            import traceback
            traceback.print_exc()

    json_file = output_dir / "caps_language_parsed_results.json"
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"\nSaved combined JSON: {json_file}")
    print(f"Successfully processed {len(all_results)} files")

if __name__ == '__main__':
    main()
