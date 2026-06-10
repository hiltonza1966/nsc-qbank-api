-- ============================================================
-- CLEANUP & COMPLETION SCRIPT for CAPS Migration
-- Date: 2026-06-10
-- Purpose: Fix partial migration state and complete seeding
-- ============================================================

-- ============================================================
-- STEP 1: CHECK CURRENT STATE (run these first to verify)
-- ============================================================

-- Check if topics exist
SELECT 'Topics in lookup_caps_topics' as check_name, COUNT(*) as count FROM lookup_caps_topics WHERE subject_official_code = 'LIFE_SC';

-- Check if subtopics exist  
SELECT 'Subtopics for LIFE_SC Grade 12' as check_name, COUNT(*) as count 
FROM lookup_caps_subtopics s 
JOIN lookup_caps_topics t ON s.topic_id = t.topic_id 
WHERE t.subject_official_code = 'LIFE_SC' AND t.grade_id = 12;

-- Check columns in parse_expected_structure
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
FROM information_schema.columns 
WHERE table_schema = DATABASE() 
AND table_name = 'parse_expected_structure' 
AND COLUMN_NAME IN ('caps_topic_id', 'caps_reference', 'cognitive_level_weighting', 'is_anchor_item');

-- Check if item_caps_mapping table exists
SELECT COUNT(*) as table_exists FROM information_schema.tables 
WHERE table_schema = DATABASE() AND table_name = 'item_caps_mapping';

-- Check if views exist
SELECT table_name FROM information_schema.views 
WHERE table_schema = DATABASE() AND table_name LIKE 'vw_curriculum%';

-- ============================================================
-- STEP 2: CLEANUP - Remove partial topic data if needed
-- ============================================================

-- ONLY RUN THIS IF YOU WANT TO START FRESH
-- DELETE FROM lookup_caps_subtopics WHERE topic_id IN (SELECT topic_id FROM lookup_caps_topics WHERE subject_official_code = 'LIFE_SC');
-- DELETE FROM lookup_caps_topics WHERE subject_official_code = 'LIFE_SC';

-- ============================================================
-- STEP 3: RE-SEED WITH INSERT IGNORE (skips duplicates)
-- ============================================================

-- Ensure strand column is wide enough
ALTER TABLE lookup_caps_topics MODIFY COLUMN strand VARCHAR(100) NOT NULL;

-- Grade 10 topics (12 topics) - INSERT IGNORE skips duplicates
INSERT IGNORE INTO lookup_caps_topics (subject_official_code, grade_id, strand, term, topic_code, topic_name, topic_weighting, time_weeks, paper_no, description, display_order) VALUES
('LIFE_SC', 10, 'Strand 1: Life at the Molecular, Cellular and Tissue Level', 'T1', 'LIFE_10_1_1', 'Orientation to Life Sciences', NULL, 1.0, 1, 'Subject orientation: nature of science, scientific skills, safety, careers. NOT assessable but principles assessed in context.', 1),
('LIFE_SC', 10, 'Strand 1: Life at the Molecular, Cellular and Tissue Level', 'T1', 'LIFE_10_1_2', 'Chemistry of Life', 16.0, 2.5, 1, 'Inorganic and organic compounds, molecules for life, food tests, enzymes. Links to Grade 9.', 2),
('LIFE_SC', 10, 'Strand 1: Life at the Molecular, Cellular and Tissue Level', 'T1', 'LIFE_10_1_3', 'Cells: Basic Units of Life', 17.0, 3.0, 1, 'Cell structure and function, organelles, microscopy, plant vs animal cells. Links to Grade 9.', 3),
('LIFE_SC', 10, 'Strand 1: Life at the Molecular, Cellular and Tissue Level', 'T1', 'LIFE_10_1_4', 'Cell Division: Mitosis', 12.0, 2.0, 1, 'The cell cycle, interphase, mitosis phases, cytokinesis, growth and repair, cancer.', 4),
('LIFE_SC', 10, 'Strand 1: Life at the Molecular, Cellular and Tissue Level', 'T2', 'LIFE_10_1_5', 'Plant and Animal Tissues', 13.0, 2.0, 1, 'Plant tissues (xylem, phloem, parenchyma, etc.) and animal tissues (epithelial, connective, muscle, nerve).', 5),
('LIFE_SC', 10, 'Strand 1: Life at the Molecular, Cellular and Tissue Level', 'T2', 'LIFE_10_1_6', 'Plant Organs (Leaf)', 3.0, 0.5, 1, 'Leaf structure: cross-section, functions (photosynthesis, gas exchange, transport).', 6),
('LIFE_SC', 10, 'Strand 2: Life Processes in Plants and Animals', 'T2', 'LIFE_10_2_1', 'Support and Transport Systems in Plants', 17.0, 3.0, 1, 'Anatomy of dicot plants, transpiration, water and mineral transport, secondary growth.', 7),
('LIFE_SC', 10, 'Strand 2: Life Processes in Plants and Animals', 'T2', 'LIFE_10_2_2', 'Support Systems in Animals', 17.0, 3.0, 1, 'Skeleton types, human skeleton, joints, muscles, locomotion, diseases of skeleton.', 8),
('LIFE_SC', 10, 'Strand 2: Life Processes in Plants and Animals', 'T3', 'LIFE_10_2_3', 'Transport Systems in Mammals', 20.0, 3.0, 2, 'Circulatory system, heart structure, blood vessels, cardiac cycle, lymphatic system, heart diseases.', 9),
('LIFE_SC', 10, 'Strand 3: Environmental Studies', 'T3', 'LIFE_10_3_1', 'Biosphere to Ecosystems', 40.0, 6.0, 2, 'Biomes, ecosystems, abiotic and biotic factors, energy flow, trophic levels, nutrient cycles, ecotourism.', 10),
('LIFE_SC', 10, 'Strand 4: Diversity, Change and Continuity', 'T4', 'LIFE_10_4_1', 'Biodiversity and Classification', 7.0, 1.0, 2, 'Five-kingdom system, binomial nomenclature, prokaryotes vs eukaryotes, classification schemes.', 11),
('LIFE_SC', 10, 'Strand 4: Diversity, Change and Continuity', 'T4', 'LIFE_10_4_2', 'History of Life on Earth', 33.0, 5.0, 2, 'Geological timescale, fossil evidence, mass extinctions, South African fossil record, fossil tourism.', 12);

-- Grade 11 topics (10 topics)
INSERT IGNORE INTO lookup_caps_topics (subject_official_code, grade_id, strand, term, topic_code, topic_name, topic_weighting, time_weeks, paper_no, description, display_order) VALUES
('LIFE_SC', 11, 'Strand 4: Diversity, Change and Continuity', 'T1', 'LIFE_11_4_1', 'Biodiversity of Microorganisms', 20.0, 3.0, 2, 'Viruses, bacteria, protista, fungi: structure, diseases, immunity, biotechnology, traditional technology.', 1),
('LIFE_SC', 11, 'Strand 4: Diversity, Change and Continuity', 'T1', 'LIFE_11_4_2', 'Biodiversity of Plants', 20.0, 3.0, 2, 'Bryophytes, pteridophytes, gymnosperms, angiosperms: reproduction, pollination, seeds, phylogenetic trees.', 2),
('LIFE_SC', 11, 'Strand 4: Diversity, Change and Continuity', 'T1', 'LIFE_11_4_3', 'Biodiversity of Animals', 13.0, 2.0, 2, 'Six phyla: body plans, symmetry, tissue layers, coelom, phylogenetic trees, South African examples.', 3),
('LIFE_SC', 11, 'Strand 2: Life Processes in Plants and Animals', 'T2', 'LIFE_11_2_1', 'Energy Transformations: Photosynthesis', 18.0, 3.0, 1, 'Process of photosynthesis, factors affecting rate, greenhouse systems, ATP as energy carrier.', 4),
('LIFE_SC', 11, 'Strand 2: Life Processes in Plants and Animals', 'T2', 'LIFE_11_2_2', 'Animal Nutrition', 27.0, 3.0, 1, 'Human nutrition, digestion, absorption, assimilation, homeostatic control, malnutrition, diabetes.', 5),
('LIFE_SC', 11, 'Strand 2: Life Processes in Plants and Animals', 'T2', 'LIFE_11_2_3', 'Energy Transformations: Respiration', 15.0, 1.5, 1, 'Aerobic and anaerobic respiration, glycolysis, Krebs cycle, fermentation, industrial applications.', 6),
('LIFE_SC', 11, 'Strand 2: Life Processes in Plants and Animals', 'T3', 'LIFE_11_2_4', 'Gaseous Exchange', 15.0, 2.5, 1, 'Gas exchange organs, human ventilation system, lung structure, diseases (TB, asthma, smoking effects).', 7),
('LIFE_SC', 11, 'Strand 2: Life Processes in Plants and Animals', 'T3', 'LIFE_11_2_5', 'Excretion in Humans', 15.0, 2.5, 1, 'Excretory organs, urinary system, kidney structure, nephron function, homeostatic control, dialysis.', 8),
('LIFE_SC', 11, 'Strand 3: Environmental Studies', 'T3', 'LIFE_11_3_1', 'Population Ecology', 36.0, 4.0, 1, 'Population dynamics, interactions (predation, competition, symbiosis), succession, human population.', 9),
('LIFE_SC', 11, 'Strand 3: Environmental Studies', 'T4', 'LIFE_11_3_2', 'Human Impact on the Environment', 47.0, 7.0, 2, 'Climate change, water availability/quality, food security, biodiversity loss, waste disposal, sustainability.', 10);

-- Grade 12 topics (11 topics)
INSERT IGNORE INTO lookup_caps_topics (subject_official_code, grade_id, strand, term, topic_code, topic_name, topic_weighting, time_weeks, paper_no, description, display_order) VALUES
('LIFE_SC', 12, 'Strand 1: Life at the Molecular, Cellular and Tissue Level', 'T1', 'LIFE_12_1_1', 'DNA: Code of Life', 19.0, 2.5, 2, 'DNA structure, discovery, replication, RNA types, transcription, translation, protein synthesis, genetic code.', 1),
('LIFE_SC', 12, 'Strand 1: Life at the Molecular, Cellular and Tissue Level', 'T1', 'LIFE_12_1_2', 'Meiosis', 7.0, 2.0, 1, 'Reduction division, gametogenesis, genetic variation (crossing over, segregation), abnormal meiosis (Down syndrome).', 2),
('LIFE_SC', 12, 'Strand 2: Life Processes in Plants and Animals', 'T1', 'LIFE_12_2_1', 'Reproduction in Vertebrates', 4.0, 0.5, 1, 'Reproductive strategies: fertilisation types, ovipary/vivipary, parental care, amniotic egg, development.', 3),
('LIFE_SC', 12, 'Strand 2: Life Processes in Plants and Animals', 'T1', 'LIFE_12_2_2', 'Human Reproduction', 21.0, 3.0, 1, 'Male/female systems, puberty, gametogenesis, menstrual cycle, fertilisation, implantation, pregnancy, contraception.', 4),
('LIFE_SC', 12, 'Strand 2: Life Processes in Plants and Animals', 'T2', 'LIFE_12_2_3', 'Responding to the Environment: Humans', 30.0, 4.0, 1, 'Nervous system (CNS, PNS, reflex arc), senses (eye, ear), drugs and effects, reaction time.', 5),
('LIFE_SC', 12, 'Strand 1: Life at the Molecular, Cellular and Tissue Level', 'T2', 'LIFE_12_1_3', 'Human Endocrine System', 15.0, 1.5, 1, 'Endocrine glands, hormones (ADH, TSH, insulin, glucagon, etc.), negative feedback, diabetes.', 6),
('LIFE_SC', 12, 'Strand 2: Life Processes in Plants and Animals', 'T2', 'LIFE_12_2_4', 'Homeostasis in Humans', 7.0, 1.0, 1, 'Temperature regulation, water and salt balance, skin adaptations, sweating, vasodilation/vasoconstriction.', 7),
('LIFE_SC', 12, 'Strand 2: Life Processes in Plants and Animals', 'T2', 'LIFE_12_2_5', 'Responding to the Environment: Plants', 7.0, 1.0, 1, 'Plant hormones (auxins, gibberellins, abscisic acid), tropisms (geotropism, phototropism), defence mechanisms.', 8),
('LIFE_SC', 12, 'Strand 4: Diversity, Change and Continuity', 'T3', 'LIFE_12_4_1', 'Evolution by Natural Selection', 15.0, 2.0, 2, 'Darwinism, natural selection, speciation, reproductive isolation, evidence, artificial selection, resistance.', 9),
('LIFE_SC', 12, 'Strand 4: Diversity, Change and Continuity', 'T3', 'LIFE_12_4_2', 'Human Evolution', 15.0, 2.0, 2, 'Hominid evolution, African origins, fossil evidence (Taung, Sterkfontein), genetic evidence, Out of Africa.', 10),
('LIFE_SC', 12, 'Strand 3: Environmental Studies', 'T4', 'LIFE_12_3_1', 'Human Impact on the Environment', 17.0, 2.5, 1, 'Population growth, climate change, water, food security, biodiversity loss, waste, sustainability, indigenous knowledge.', 11);

-- ============================================================
-- STEP 4: INSERT SUBTOPICS (Grade 12 only - 51 subtopics)
-- Uses INSERT IGNORE to skip if already exist
-- ============================================================

-- LIFE_12_1_1: DNA: Code of Life
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_1_1_A', 'DNA Structure and Discovery', 'LIFE 2.1.1', 'Discovery by Watson, Crick, Franklin, Wilkins; structure of DNA; location in cell; chromosomes, genes, extranuclear DNA', 1 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_1';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_1_1_B', 'DNA Replication', 'LIFE 2.1.2', 'Cell cycle link; necessity for exact copy; replication process', 2 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_1';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_1_1_C', 'RNA Types and Structure', 'LIFE 2.1.3', 'Types and location; structure of RNA', 3 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_1';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_1_1_D', 'Transcription and Translation', 'LIFE 2.1.4', 'Transcription from DNA; translation into proteins; mRNA, tRNA; sequence of events; genetic code', 4 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_1';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_1_1_E', 'DNA Profiling', 'LIFE 2.1.5', 'DNA fingerprinting; DNA profiling; case study only', 5 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_1';

-- LIFE_12_1_2: Meiosis
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_1_2_A', 'Process of Meiosis', 'LIFE 2.2.1', 'Reduction division; purposes (gametogenesis); exceptions (mosses, ferns); importance: diploid to haploid', 1 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_2';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_1_2_B', 'Genetic Variation', 'LIFE 2.2.2', 'Random segregation; crossing over; introduction of variation', 2 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_2';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_1_2_C', 'Abnormal Meiosis', 'LIFE 2.2.3', 'Consequences of abnormal meiosis; Down syndrome', 3 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_2';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_1_2_D', 'Mitosis vs Meiosis', 'LIFE 2.2.4', 'Similarities and differences; link to Grade 10', 4 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_2';

-- LIFE_12_2_1: Reproduction in Vertebrates
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_1_A', 'Reproductive Strategies', 'LIFE 2.3.1', 'External/internal fertilisation; ovipary/ovovivipary/vivipary; amniotic egg; precocial/altricial; parental care', 1 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_1';

-- LIFE_12_2_2: Human Reproduction
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_2_A', 'Male Reproductive System', 'LIFE 2.4.1', 'Structure and function; link to Grade 7 and 9', 1 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_2';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_2_B', 'Female Reproductive System', 'LIFE 2.4.2', 'Structure and function; link to Grade 7 and 9', 2 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_2';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_2_C', 'Puberty and Gametogenesis', 'LIFE 2.4.3', 'Main changes; gametogenesis linked to meiosis', 3 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_2';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_2_D', 'Menstrual Cycle', 'LIFE 2.4.4', 'Hormonal control; phases', 4 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_2';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_2_E', 'Fertilisation and Development', 'LIFE 2.4.5', 'Fertilisation; zygote to blastocyst; implantation; placenta role', 5 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_2';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_2_F', 'Contraception', 'LIFE 2.4.6', 'Contraceptive methods; family planning', 6 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_2';

-- LIFE_12_2_3: Responding to the Environment: Humans
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_3_A', 'Human Nervous System', 'LIFE 2.5.1', 'CNS (brain, spinal cord); PNS; autonomic nervous system; nerve structure; reflex arc; synapses', 1 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_3';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_3_B', 'The Eye', 'LIFE 2.5.2', 'Structure and function; binocular vision; accommodation; pupil reflex; defects', 2 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_3';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_3_C', 'The Ear', 'LIFE 2.5.3', 'Structure and function; hearing and balance; defects', 3 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_3';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_3_D', 'Receptors', 'LIFE 2.5.4', 'Detection of stimuli: light, sound, touch, temperature, pressure, pain, chemicals', 4 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_3';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_3_E', 'Drugs and Effects', 'LIFE 2.5.5', 'Dagga, heroin, ecstasy, tik; effects on nervous system', 5 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_3';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_3_F', 'Disorders and Injuries', 'LIFE 2.5.6', 'Alzheimers, multiple sclerosis; brain/spinal damage; stem cell research', 6 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_3';

-- LIFE_12_1_3: Human Endocrine System
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_1_3_A', 'Endocrine Glands', 'LIFE 2.6.1', 'Hypothalamus, pituitary, thyroid, pancreas, adrenal, gonads: location, hormones, roles', 1 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_3';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_1_3_B', 'Negative Feedback', 'LIFE 2.6.2', 'TSH and thyroxin; insulin and glucagon; glucose regulation', 2 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_3';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_1_3_C', 'Diabetes', 'LIFE 2.6.3', 'Type 1 and Type 2; increase in prevalence; management', 3 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_3';

-- LIFE_12_2_4: Homeostasis in Humans
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_4_A', 'Homeostasis Concepts', 'LIFE 2.7.1', 'Maintaining constant internal environment; negative feedback examples', 1 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_4';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_4_B', 'Thermoregulation', 'LIFE 2.7.2', 'Skin adaptations; sweating; vasodilation; vasoconstriction; shivering', 2 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_4';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_4_C', 'Water and Salt Balance', 'LIFE 2.7.3', 'ADH and aldosterone; kidney function; dehydration', 3 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_4';

-- LIFE_12_2_5: Responding to the Environment: Plants
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_5_A', 'Plant Hormones', 'LIFE 2.8.1', 'Auxins, gibberellins, abscisic acid: general functions', 1 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_5';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_5_B', 'Tropisms', 'LIFE 2.8.2', 'Geotropism and phototropism; growth regulation by auxins', 2 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_5';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_5_C', 'Plant Defence', 'LIFE 2.8.3', 'Chemicals, thorns, physical barriers', 3 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_5';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_2_5_D', 'Weed Control', 'LIFE 2.8.4', 'Using growth hormones as herbicides', 4 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_5';

-- LIFE_12_4_1: Evolution by Natural Selection
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_4_1_A', 'Origin of Ideas', 'LIFE 2.9.1', 'Hypothesis vs theory; Lamarckism, Darwinism, Punctuated Equilibrium', 1 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_4_1';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_4_1_B', 'Evidence for Evolution', 'LIFE 2.9.2', 'Fossil record, modification by descent, biogeography, genetics, other evidence', 2 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_4_1';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_4_1_C', 'Natural Selection', 'LIFE 2.9.3', 'Variation, overproduction, environmental pressure, adaptation, survival', 3 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_4_1';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_4_1_D', 'Artificial Selection', 'LIFE 2.9.4', 'One domesticated animal and one crop species example', 4 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_4_1';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_4_1_E', 'Speciation', 'LIFE 2.9.5', 'Reproductive isolation mechanisms; geographic isolation example (Galapagos)', 5 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_4_1';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_4_1_F', 'Evolution in Present Times', 'LIFE 2.9.6', 'Resistance to insecticides, antibiotics, antiretrovirals; Galapagos finches', 6 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_4_1';

-- LIFE_12_4_2: Human Evolution
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_4_2_A', 'African Origins', 'LIFE 2.10.1', 'Evidence for African origins: genetic links, mitochondrial DNA', 1 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_4_2';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_4_2_B', 'Common Ancestors', 'LIFE 2.10.2', 'Anatomical differences/similarities between African apes and humans', 2 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_4_2';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_4_2_C', 'Fossil Evidence', 'LIFE 2.10.3', 'Key features: bipedalism, brain size, dentition, prognathism; thousands of fragments found', 3 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_4_2';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_4_2_D', 'Major Hominid Genera', 'LIFE 2.10.4', 'Ardipithecus, Australopithecus, Homo: diagnostic features, time periods', 4 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_4_2';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_4_2_E', 'South African Sites', 'LIFE 2.10.5', 'Taung, Sterkfontein, Kromdraai, Swartkrans, Malapa, Cradle of Humankind', 5 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_4_2';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_4_2_F', 'Scientists and Contributions', 'LIFE 2.10.6', 'Dart, Broom, Tobias, Brain, Clark, Berger, Keyser and others', 6 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_4_2';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_4_2_G', 'Alternatives to Evolution', 'LIFE 2.10.7', 'Creationism, Intelligent Design, Literalism, Theistic evolution', 7 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_4_2';

-- LIFE_12_3_1: Human Impact on the Environment
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_3_1_A', 'Atmosphere and Climate Change', 'LIFE 2.11.1', 'Carbon dioxide, methane, ozone depletion, greenhouse effect, global warming, carbon footprint', 1 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_3_1';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_3_1_B', 'Water Resources', 'LIFE 2.11.2', 'Availability, quality, dams, wetlands, farming, eutrophication, pollution', 2 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_3_1';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_3_1_C', 'Food Security', 'LIFE 2.11.3', 'Population growth, farming practices, monoculture, GMOs, wastage', 3 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_3_1';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_3_1_D', 'Biodiversity Loss', 'LIFE 2.11.4', 'Habitat destruction, poaching, alien invasions, sixth extinction', 4 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_3_1';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_3_1_E', 'Solid Waste', 'LIFE 2.11.5', 'Waste management, recycling, rehabilitation, methane use, nuclear waste', 5 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_3_1';
INSERT IGNORE INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, caps_reference, description, display_order) 
SELECT topic_id, 'LIFE_12_3_1_F', 'Indigenous Knowledge', 'LIFE 2.11.6', 'Devils claw, rooibos, fynbos, African potato, Hoodia, sustainable use', 6 FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_3_1';

-- ============================================================
-- STEP 5: VERIFY TOPIC SEEDING
-- ============================================================

SELECT '=== TOPIC COUNTS ===' as status;
SELECT grade_id, COUNT(*) as topic_count FROM lookup_caps_topics WHERE subject_official_code = 'LIFE_SC' GROUP BY grade_id;
SELECT '=== SUBTOPIC COUNT (Grade 12) ===' as status;
SELECT COUNT(*) as subtopic_count FROM lookup_caps_subtopics s JOIN lookup_caps_topics t ON s.topic_id = t.topic_id WHERE t.subject_official_code = 'LIFE_SC' AND t.grade_id = 12;
