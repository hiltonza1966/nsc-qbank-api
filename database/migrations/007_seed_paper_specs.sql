USE nsc_registration_v3;

INSERT INTO qbank_paper_specs (subject_official_code, paper_no, cognitive_weighting, difficulty_weighting, sections_config)
VALUES ('19331054',2,'{"Remember":20,"Understand":30,"Apply":30,"Analyse":10,"Evaluate":5,"Create":5}','{"Easy":30,"Medium":50,"Hard":20}','[{"name":"A","marks":75},{"name":"B","marks":75}]')
ON DUPLICATE KEY UPDATE sections_config=VALUES(sections_config);