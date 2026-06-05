const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

router.post('/generate', async (req,res)=>{
  const db=req.db;
  const {subject_official_code,paper_no,title}=req.body;
  const conn=await db.getConnection();
  try{
    await conn.beginTransaction();
    const [specs]=await conn.execute(`SELECT * FROM qbank_paper_specs WHERE subject_official_code=? AND paper_no=?`,[subject_official_code,paper_no]);
    if(!specs.length) throw new Error('No spec');
    const spec=specs[0];
    const sections = spec.sections_config; // already parsed by mysql2

    const paper_id=uuidv4();
    await conn.execute(`INSERT INTO qbank_papers (paper_id,subject_official_code,paper_no,title,total_marks,duration_minutes,status,created_by) VALUES (?,?,?,?,?,?, 'Draft',1)`,
      [paper_id,subject_official_code,paper_no,title,spec.total_marks,spec.duration_minutes]);

    let pos=1;
    for(const sec of sections){
      const [items]=await conn.execute(`SELECT * FROM qbank_items WHERE subject_official_code=? AND paper_no=? AND status='Approved' ORDER BY RAND() LIMIT 20`,[subject_official_code,paper_no]);
      let marks=0;
      for(const it of items){
        if(marks>=sec.marks) break;
        await conn.execute(`INSERT INTO qbank_paper_items (paper_id,item_id,section_name,position,marks_allocated) VALUES (?,?,?,?,?)`,[paper_id,it.item_id,sec.name,pos++,it.marks]);
        marks+=it.marks;
      }
    }
    await conn.commit();
    res.json({success:true,paper_id});
  }catch(e){await conn.rollback();res.status(500).json({error:e.message});}
  finally{conn.release();}
});

router.get('/:id', async (req,res)=>{
  const db=req.db;
  const [p]=await db.execute(`SELECT * FROM qbank_papers WHERE paper_id=?`,[req.params.id]);
  const [items]=await db.execute(`SELECT pi.*,i.question_text FROM qbank_paper_items pi JOIN qbank_items i ON pi.item_id=i.item_id WHERE pi.paper_id=? ORDER BY pi.position`,[req.params.id]);
  res.json({...p[0],items});
});

module.exports=router;