const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

router.post('/', async (req,res)=>{
  const db=req.db;
  const {subject_official_code,paper_no,question_text,marks,topic,cognitive_level,difficulty,created_by=1}=req.body;
  const item_id=uuidv4();
  try{
    await db.execute(`INSERT INTO qbank_items (item_id,subject_official_code,paper_no,question_text,marks,topic,cognitive_level,difficulty,status,created_by) VALUES (?,?,?,?,?,?,?,?, 'Draft',?)`,
      [item_id,subject_official_code,paper_no,question_text,marks,topic,cognitive_level,difficulty,created_by]);
    res.json({success:true,item_id});
  }catch(e){res.status(500).json({error:e.message});}
});

router.get('/', async (req,res)=>{
  const db=req.db;
  const {subject,paper}=req.query;
  let sql=`SELECT * FROM qbank_items WHERE 1=1`; const p=[];
  if(subject){sql+=` AND subject_official_code=?`;p.push(subject);}
  if(paper){sql+=` AND paper_no=?`;p.push(paper);}
  sql+=` ORDER BY created_at DESC LIMIT 100`;
  const [rows]=await db.execute(sql,p);
  res.json(rows);
});

module.exports=router;