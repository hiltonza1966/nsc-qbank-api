#!/usr/bin/env python3
"""List all PDF filenames in CAPS Documents folder for exact mapping"""

import os
import sys

folder_path = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents"

if not os.path.exists(folder_path):
    print(f"Folder not found: {folder_path}")
    sys.exit(1)

pdf_files = [f for f in os.listdir(folder_path) if f.lower().endswith('.pdf') and os.path.isfile(os.path.join(folder_path, f))]
pdf_files.sort()

print(f"Total PDFs in folder: {len(pdf_files)}")
print("=" * 80)

for i, f in enumerate(pdf_files, 1):
    print(f"{i:2d}. {f}")

print("\n" + "=" * 80)
print("SUGGESTED SUBJECT_MAP entries:")
print("=" * 80)

for f in pdf_files:
    f_upper = f.upper()

    # Skip non-CAPS docs
    if any(skip in f_upper for skip in ['AMENDMENT', 'ART SUBJECTS', 'CIVIL TECH FINAL', 'ELECTRICAL TECH FINAL', 
                                          'MATHS TECH FINAL', 'MECH TECH FINAL', 'SCIENCE TECH', 'EQUINE', 
                                          'FET CAP DRAFT', 'MARITIME', 'MARINE SCIENCES', 'NAUTICAL', 
                                          'SPORT AND EXERCISE']):
        continue

    # Extract subject name from filename
    # Pattern: CAPS FET _ [TYPE] _ SUBJECT GR 10-12 _ ...
    # or: CAPS FET _ SUBJECT _ GR 10-12 _ ...

    subject_name = None
    alpha_code = None
    official_code = None

    if '_ FAL _ ' in f_upper or ' FAL ' in f_upper:
        if 'AFRIKAANS' in f_upper:
            subject_name = "Afrikaans First Additional Language"
            alpha_code = "AFAL"
            official_code = "10001114"
        elif 'ENGLISH' in f_upper:
            subject_name = "English First Additional Language"
            alpha_code = "ENFL"
            official_code = "10001324"
        elif 'ISIXHOSA' in f_upper or 'ISI XHOSA' in f_upper:
            subject_name = "isiXhosa First Additional Language"
            alpha_code = "XHFL"
            official_code = "10001134"
        elif 'ISIZULU' in f_upper or 'ISI ZULU' in f_upper:
            subject_name = "isiZulu First Additional Language"
            alpha_code = "ZUFL"
            official_code = "10001144"
        elif 'SEPEDI' in f_upper:
            subject_name = "Sepedi First Additional Language"
            alpha_code = "SEFL"
            official_code = "10001154"
        elif 'SESOTHO' in f_upper:
            subject_name = "Sesotho First Additional Language"
            alpha_code = "SOFL"
            official_code = "10001164"
        elif 'SETSWANA' in f_upper:
            subject_name = "Setswana First Additional Language"
            alpha_code = "TSFL"
            official_code = "10001174"
        elif 'SISWATI' in f_upper:
            subject_name = "siSwati First Additional Language"
            alpha_code = "SWFL"
            official_code = "10001184"
        elif 'TSHIVENDA' in f_upper or 'THSIVENDA' in f_upper:
            subject_name = "Tshivenda First Additional Language"
            alpha_code = "TVFL"
            official_code = "10001194"
        elif 'XITSONGA' in f_upper:
            subject_name = "Xitsonga First Additional Language"
            alpha_code = "XTFL"
            official_code = "10001204"
        elif 'ISINDEBELE' in f_upper or 'ISI NDEBELE' in f_upper:
            subject_name = "isiNdebele First Additional Language"
            alpha_code = "NDFL"
            official_code = "10001214"

    elif '_ HOME _ ' in f_upper or ' HOME ' in f_upper:
        if 'AFRIKAANS' in f_upper:
            subject_name = "Afrikaans Home Language"
            alpha_code = "AFHL"
            official_code = "10001094"
        elif 'ENGLISH' in f_upper:
            subject_name = "English Home Language"
            alpha_code = "ENGL"
            official_code = "10001014"
        elif 'ISIXHOSA' in f_upper or 'ISI XHOSA' in f_upper:
            subject_name = "isiXhosa Home Language"
            alpha_code = "XHOS"
            official_code = "10001614"
        elif 'ISIZULU' in f_upper or 'ISI ZULU' in f_upper:
            subject_name = "isiZulu Home Language"
            alpha_code = "ZULU"
            official_code = "10001594"
        elif 'SEPEDI' in f_upper:
            subject_name = "Sepedi Home Language"
            alpha_code = "SETH"
            official_code = "10001524"
        elif 'SESOTHO' in f_upper:
            subject_name = "Sesotho Home Language"
            alpha_code = "SOTHO"
            official_code = "10001624"
        elif 'SETSWANA' in f_upper:
            subject_name = "Setswana Home Language"
            alpha_code = "TSWA"
            official_code = "10001634"
        elif 'SISWATI' in f_upper:
            subject_name = "siSwati Home Language"
            alpha_code = "SWAT"
            official_code = "10001644"
        elif 'TSHIVENDA' in f_upper:
            subject_name = "Tshivenda Home Language"
            alpha_code = "TSHI"
            official_code = "10001654"
        elif 'XITSONGA' in f_upper:
            subject_name = "Xitsonga Home Language"
            alpha_code = "XITS"
            official_code = "10001664"
        elif 'ISINDEBELE' in f_upper or 'ISI NDEBELE' in f_upper:
            subject_name = "isiNdebele Home Language"
            alpha_code = "NDEB"
            official_code = "10001674"

    else:
        # Direct subject names
        if 'ACCOUNTING' in f_upper:
            subject_name = "Accounting"
            alpha_code = "ACCN"
            official_code = "10001024"
        elif 'AGRI MANAGEMENT' in f_upper or 'AGRICULTURAL MANAGEMENT' in f_upper:
            subject_name = "Agricultural Management Practices"
            alpha_code = "AGMP"
            official_code = "10351064"
        elif 'AGRICULTURAL SCIENCE' in f_upper and 'AGRI MANAGEMENT' not in f_upper and 'AGRICULTURAL TECHNOLOGY' not in f_upper:
            subject_name = "Agricultural Sciences"
            alpha_code = "AGRI"
            official_code = "10351054"
        elif 'AGRICULTURAL TECHNOLOGY' in f_upper:
            subject_name = "Agricultural Technology"
            alpha_code = "AGRT"
            official_code = "10351074"
        elif 'BUSINESS STUDIES' in f_upper:
            subject_name = "Business Studies"
            alpha_code = "BUSN"
            official_code = "10001164"
        elif 'CIVIL TECHNOLOGY' in f_upper:
            subject_name = "Civil Technology"
            alpha_code = "CIVL"
            official_code = "10001204"
        elif 'COMPUTER APPLICATIONS' in f_upper:
            subject_name = "Computer Applications Technology"
            alpha_code = "CATN"
            official_code = "10001204"
        elif 'CONSUMER STUDIES' in f_upper:
            subject_name = "Consumer Studies"
            alpha_code = "CONS"
            official_code = "10001234"
        elif 'DANCE STUDIES' in f_upper:
            subject_name = "Dance Studies"
            alpha_code = "DANC"
            official_code = "11351094"
        elif 'DESIGN STUDIES' in f_upper:
            subject_name = "Design Studies"
            alpha_code = "DSGN"
            official_code = "11351104"
        elif 'DRAMATIC ARTS' in f_upper:
            subject_name = "Dramatic Arts"
            alpha_code = "DRAM"
            official_code = "11351084"
        elif 'ECONOMICS' in f_upper:
            subject_name = "Economics"
            alpha_code = "ECON"
            official_code = "10001264"
        elif 'ELECTRICAL TECHNOLOGY' in f_upper:
            subject_name = "Electrical Technology"
            alpha_code = "ELEC"
            official_code = "10001274"
        elif 'ENGINEERING GRAPHICS' in f_upper or 'ENGINEERING GRAPICHS' in f_upper:
            subject_name = "Engineering Graphics and Design"
            alpha_code = "EGDN"
            official_code = "10001284"
        elif 'GEOGRAPHY' in f_upper:
            subject_name = "Geography"
            alpha_code = "GEOG"
            official_code = "10001354"
        elif 'HISTORY' in f_upper:
            subject_name = "History"
            alpha_code = "HIST"
            official_code = "10001374"
        elif 'HOSPITALITY STUDIES' in f_upper:
            subject_name = "Hospitality Studies"
            alpha_code = "HTEL"
            official_code = "11351124"
        elif 'INFORMATION TECHNOLOGY' in f_upper:
            subject_name = "Information Technology"
            alpha_code = "INFT"
            official_code = "10001404"
        elif 'LIFE ORIENTATION' in f_upper:
            subject_name = "Life Orientation"
            alpha_code = "LO"
            official_code = "10001424"
        elif 'LIFE SCIENCES' in f_upper:
            subject_name = "Life Sciences"
            alpha_code = "LFSC"
            official_code = "10001034"
        elif 'MATHEMATICAL LITERACY' in f_upper:
            subject_name = "Mathematical Literacy"
            alpha_code = "MLIT"
            official_code = "10001474"
        elif 'MATHEMATICS' in f_upper and 'MATHEMATICAL LITERACY' not in f_upper and 'TECH' not in f_upper:
            subject_name = "Mathematics"
            alpha_code = "MATH"
            official_code = "10001044"
        elif 'MECHANICAL TECHNOLOGY' in f_upper:
            subject_name = "Mechanical Technology"
            alpha_code = "MECH"
            official_code = "10001494"
        elif 'MUSIC' in f_upper:
            subject_name = "Music"
            alpha_code = "MUSI"
            official_code = "11351154"
        elif 'PHYSICAL SCIENCE' in f_upper:
            subject_name = "Physical Sciences"
            alpha_code = "PHYS"
            official_code = "10001064"
        elif 'RELIGION STUDIES' in f_upper:
            subject_name = "Religion Studies"
            alpha_code = "RELI"
            official_code = "10001504"
        elif 'TECHNICAL MATHEMATICS' in f_upper or 'MATHS TECH' in f_upper:
            subject_name = "Technical Mathematics"
            alpha_code = "TMAT"
            official_code = "10001634"
        elif 'TECHNICAL SCIENCES' in f_upper or 'SCIENCE TECH' in f_upper:
            subject_name = "Technical Sciences"
            alpha_code = "TECH"
            official_code = "10001654"
        elif 'TOURISM' in f_upper:
            subject_name = "Tourism"
            alpha_code = "TOUR"
            official_code = "10001584"
        elif 'VISUAL ARTS' in f_upper:
            subject_name = "Visual Arts"
            alpha_code = "VSLA"
            official_code = "11351184"

    if subject_name:
        print(f'"{f}": ("{official_code}", "{alpha_code}", "{subject_name}", "FET", "10-12"),')
    else:
        print(f'"{f}": UNMAPPED')

if __name__ == "__main__":
    main()
