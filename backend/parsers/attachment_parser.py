#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QBank Attachment Parser v2
Detects BOTH embedded raster images AND vector diagrams (PDF paths).
Filters noise, classifies, and associates with question anchors.
"""

import fitz
import os
import json
import sys
import argparse
import hashlib
import base64
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from collections import defaultdict


# ============================================================
# CONFIG
# ============================================================

class Config:
    MIN_IMG_WIDTH = 80
    MIN_IMG_HEIGHT = 80
    MAX_ASPECT_RATIO = 6.0
    MIN_ASPECT_RATIO = 0.15
    MIN_FILE_SIZE_KB = 1.0
    HEADER_ZONE = 80          # px from top
    FOOTER_ZONE = 60          # px from bottom
    TEMPLATE_PAGE_THRESHOLD = 3
    MAX_ASSOC_DISTANCE = 400  # px
    CONFIDENCE_DECAY = 500    # px


# ============================================================
# DATA CLASSES
# ============================================================

@dataclass
class ExtractedImage:
    page_number: int
    file_name: str
    file_path: Optional[str]
    width: int
    height: int
    file_size_kb: float
    aspect_ratio: float
    bbox: List[float]
    image_hash: str
    image_data: bytes
    is_noise: bool = False
    attachment_type: str = 'unknown'
    linked_question_number: Optional[str] = None
    relevance_score: float = 0.0
    link_method: str = ''
    is_inherited: bool = False


@dataclass
class QuestionAnchor:
    question_number: str
    page_number: int
    y_position: float
    x_position: float
    is_header: bool
    header_level: int
    parent_question: Optional[str]
    has_sub_items: bool


@dataclass
class PageCtx:
    page_number: int
    page_height: float
    page_width: float
    images: List[ExtractedImage]
    question_anchors: List[QuestionAnchor]
    text_blocks: List[Dict]
    has_questions: bool


# ============================================================
# NOISE FILTER
# ============================================================

class NoiseFilter:
    def __init__(self, cfg: Config = None):
        self.cfg = cfg or Config()
        self.global_hashes = set()
        self.template_dims = set()

    def analyze_pages(self, pages: List[PageCtx]):
        from collections import Counter
        hashes = Counter()
        dims = Counter()
        for p in pages:
            for img in p.images:
                hashes[img.image_hash] += 1
                dims[(img.width, img.height)] += 1
        total = len(pages)
        for h, c in hashes.items():
            if c >= total * 0.75:
                self.global_hashes.add(h)
        for d, c in dims.items():
            if c >= self.cfg.TEMPLATE_PAGE_THRESHOLD:
                self.template_dims.add(d)

    def keep(self, img: ExtractedImage, page: PageCtx) -> bool:
        cfg = self.cfg
        if img.image_hash in self.global_hashes:
            img.is_noise = True
            img.attachment_type = 'header_logo'
            return False
        if (img.width, img.height) in self.template_dims:
            img.is_noise = True
            img.attachment_type = 'header_logo'
            return False
        if img.width < cfg.MIN_IMG_WIDTH or img.height < cfg.MIN_IMG_HEIGHT:
            img.is_noise = True
            img.attachment_type = 'noise'
            return False
        if img.aspect_ratio > cfg.MAX_ASPECT_RATIO or img.aspect_ratio < cfg.MIN_ASPECT_RATIO:
            img.is_noise = True
            img.attachment_type = 'noise'
            return False
        if img.file_size_kb < cfg.MIN_FILE_SIZE_KB:
            img.is_noise = True
            img.attachment_type = 'noise'
            return False
        if img.bbox[3] < cfg.HEADER_ZONE and img.height < 150:
            img.is_noise = True
            img.attachment_type = 'header_logo'
            return False
        if img.bbox[1] > page.page_height - cfg.FOOTER_ZONE and img.height < 100:
            img.is_noise = True
            img.attachment_type = 'footer'
            return False
        if not page.has_questions:
            img.is_noise = True
            img.attachment_type = 'noise'
            return False
        return True


# ============================================================
# CLASSIFIER
# ============================================================

class Classifier:
    def classify(self, img: ExtractedImage, page: PageCtx) -> str:
        if img.is_noise:
            return img.attachment_type
        nearby = self._nearby_text(img, page, 60)
        if img.aspect_ratio > 2.5 and img.height > 100:
            if any(w in nearby.lower() for w in ['graph', 'chart', 'concentration', 'axis', 'scale']):
                return 'graph'
        if img.aspect_ratio > 1.5 and img.width > 200:
            if any(w in nearby.lower() for w in ['table', '|:---', 'reaction', 'thickness', 'average']):
                return 'table'
        if 0.3 <= img.aspect_ratio <= 4.0 and img.width > 100 and img.height > 100:
            return 'diagram'
        return 'stimulus'

    def _nearby_text(self, img: ExtractedImage, page: PageCtx, radius: float = 50) -> str:
        cy = (img.bbox[1] + img.bbox[3]) / 2
        cx = (img.bbox[0] + img.bbox[2]) / 2
        texts = []
        for b in page.text_blocks:
            bb = b['bbox']
            bcx = (bb[0] + bb[2]) / 2
            bcy = (bb[1] + bb[3]) / 2
            dist = ((bcx - cx)**2 + (bcy - cy)**2)**0.5
            if dist < radius:
                texts.append(b.get('text', ''))
        return ' '.join(texts)


# ============================================================
# PROXIMITY ASSOCIATION
# ============================================================

class ProximityAssoc:
    def __init__(self, cfg: Config = None):
        self.cfg = cfg or Config()

    def associate(self, page: PageCtx) -> List[ExtractedImage]:
        if not page.question_anchors:
            for img in page.images:
                if not img.is_noise:
                    img.is_noise = True
                    img.attachment_type = 'noise'
            return page.images
        anchors = sorted(page.question_anchors, key=lambda a: a.y_position)
        for img in page.images:
            if img.is_noise:
                continue
            match = self._find_best(img, anchors, direction='above')
            if not match:
                match = self._find_best(img, anchors, direction='below')
            if match:
                img.linked_question_number = match['q']
                img.relevance_score = match['conf']
                img.link_method = 'proximity'
            else:
                if anchors:
                    img.linked_question_number = anchors[0].question_number
                    img.relevance_score = 0.3
                    img.link_method = 'proximity'
                else:
                    img.relevance_score = 0.1
        return page.images

    def _find_best(self, img: ExtractedImage, anchors: List[QuestionAnchor],
                   direction: str = 'above') -> Optional[Dict]:
        img_cy = (img.bbox[1] + img.bbox[3]) / 2
        best = None
        best_dist = float('inf')
        cfg = self.cfg
        for a in anchors:
            if direction == 'above':
                if a.y_position >= img.bbox[1]:
                    continue
                dist = img_cy - a.y_position
            else:
                if a.y_position <= img.bbox[3]:
                    continue
                dist = a.y_position - img_cy
            if dist > cfg.MAX_ASSOC_DISTANCE:
                continue
            if dist < best_dist:
                best_dist = dist
                best = a
        if best:
            base_conf = max(0.1, 1.0 - (best_dist / cfg.CONFIDENCE_DECAY))
            if direction == 'below':
                base_conf *= 0.8
            return {'q': best.question_number, 'conf': round(base_conf, 2), 'dist': best_dist}
        return None

    def resolve_shared(self, pages: List[PageCtx]) -> List[PageCtx]:
        for page in pages:
            by_q = defaultdict(list)
            for img in page.images:
                if img.linked_question_number:
                    by_q[img.linked_question_number].append(img)
            for q, imgs in by_q.items():
                subs = [a for a in page.question_anchors if a.parent_question == q]
                if subs and len(imgs) == 1:
                    imgs[0].linked_question_number = q
                    imgs[0].relevance_score = 1.0
        return pages


# ============================================================
# HIERARCHY LINKER
# ============================================================

class HierarchyLinker:
    def link(self, img: ExtractedImage, all_anchors: List[QuestionAnchor]) -> ExtractedImage:
        if not img.linked_question_number or img.is_noise:
            return img
        q = img.linked_question_number
        has_subs = any(
            a.parent_question == q or
            (a.question_number.startswith(q + '.') and a.question_number != q)
            for a in all_anchors
        )
        if has_subs:
            img.is_inherited = True
        return img

    def deduplicate_hierarchy(self, records: List[Dict]) -> List[Dict]:
        """Keep image only in the most specific (deepest) hierarchy item."""
        by_img = defaultdict(list)
        for r in records:
            if not r.get('is_noise') and r.get('linked_question_number'):
                key = (r.get('page_number'), r.get('image_hash'))
                by_img[key].append(r)
        to_remove = set()
        for key, recs in by_img.items():
            if len(recs) <= 1:
                continue
            # Sort by depth (most dots = deepest)
            recs.sort(key=lambda x: x['linked_question_number'].count('.'), reverse=True)
            # Keep first (deepest), mark rest as noise
            for r in recs[1:]:
                to_remove.add(id(r))
        for r in records:
            if id(r) in to_remove:
                r['is_noise'] = True
                r['attachment_type'] = 'noise'
        return records


# ============================================================
# ATTACHMENT PARSER
# ============================================================

class AttachmentParser:
    def __init__(self, cfg: Config = None):
        self.cfg = cfg or Config()
        self.records = []

    def _extract_page_numbers(self, doc, anchors):
        """Scan PDF pages to assign actual page numbers to anchors with page_number=0."""
        import re
        result = []

        for anchor in anchors:
            qn = str(anchor.get('question_number', ''))
            page_num = anchor.get('page_number', 0)

            # If already has a page number, keep it
            if page_num and page_num != 0:
                result.append(anchor)
                continue

            # Search all pages for this question number
            found_page = 0
            found_y = 0.0
            found_x = 0.0

            # Build regex that matches the question number as a standalone marker
            escaped = re.escape(qn)
            pattern = re.compile(
                r'(?:^|[\s\(\[])' + escaped + r'(?=[\s\.\)\]\n]|$)',
                re.IGNORECASE
            )

            for p_idx in range(len(doc)):
                page = doc[p_idx]
                text = page.get_text()

                if pattern.search(text):
                    found_page = p_idx + 1  # 1-based
                    # Try to get position from first occurrence
                    rects = page.search_for(qn)
                    if rects:
                        r = rects[0]
                        found_y = r.y1
                        found_x = r.x0
                    break

            # Create updated anchor copy
            updated = dict(anchor)
            updated['page_number'] = found_page
            updated['y_position'] = found_y
            updated['x_position'] = found_x
            result.append(updated)

        return result

    def parse_pdf(self, pdf_path: str, anchors: List[Dict], paper_code: str = '') -> List[Dict]:
        self.records = []
        doc = fitz.open(pdf_path)

        # If anchors have no page numbers (all 0), extract from PDF
        if anchors and all(a.get('page_number', 0) == 0 for a in anchors):
            anchors = self._extract_page_numbers(doc, anchors)

        anchor_map = defaultdict(list)
        for a in anchors:
            anchor_map[a['page_number']].append(a)

        pages = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            page_height = page.rect.height
            page_width = page.rect.width

            # Extract both raster and vector images
            images = []
            images.extend(self._extract_embedded_raster(doc, page, page_num))
            images.extend(self._extract_vector_diagrams(page, page_num))
            images = self._deduplicate_images(images)

            page_anchors = []
            for a in anchor_map.get(page_num + 1, []):
                page_anchors.append(QuestionAnchor(
                    question_number=a['question_number'],
                    page_number=a['page_number'],
                    y_position=a['y_position'],
                    x_position=a['x_position'],
                    is_header=a.get('is_header', False),
                    header_level=a.get('header_level', 0),
                    parent_question=a.get('parent_question'),
                    has_sub_items=a.get('has_sub_items', False)
                ))

            has_questions = len(page_anchors) > 0
            text_blocks = self._get_text_blocks(page)

            pages.append(PageCtx(
                page_number=page_num + 1,
                page_height=page_height,
                page_width=page_width,
                images=images,
                question_anchors=page_anchors,
                text_blocks=text_blocks,
                has_questions=has_questions
            ))

        # Filter noise
        noise_filter = NoiseFilter(self.cfg)
        noise_filter.analyze_pages(pages)
        for page in pages:
            for img in page.images:
                noise_filter.keep(img, page)

        # Classify
        classifier = Classifier()
        for page in pages:
            for img in page.images:
                if not img.is_noise:
                    img.attachment_type = classifier.classify(img, page)

        # Associate
        assoc = ProximityAssoc(self.cfg)
        for page in pages:
            assoc.associate(page)
        assoc.resolve_shared(pages)

        # Hierarchy
        linker = HierarchyLinker()
        all_anchors = [a for p in pages for a in p.question_anchors]
        for page in pages:
            for img in page.images:
                linker.link(img, all_anchors)

        # Build records
        for page in pages:
            for img in page.images:
                rec = {
                    'page_number': img.page_number,
                    'file_name': img.file_name,
                    'file_path': img.file_path,
                    'image_width': img.width,
                    'image_height': img.height,
                    'file_size_kb': img.file_size_kb,
                    'aspect_ratio': img.aspect_ratio,
                    'bbox': img.bbox,
                    'image_hash': img.image_hash,
                    'is_noise': img.is_noise,
                    'attachment_type': img.attachment_type,
                    'linked_question_number': img.linked_question_number,
                    'relevance_score': img.relevance_score,
                    'link_method': img.link_method,
                    'image_data': img.image_data,
                    'is_inherited': img.is_inherited,
                }
                self.records.append(rec)

        # Deduplicate hierarchy
        self.records = linker.deduplicate_hierarchy(self.records)

        doc.close()
        return self.records

    def _extract_embedded_raster(self, doc, page, page_num):
        """Extract embedded raster images (PNG, JPEG)."""
        images = []
        img_list = page.get_images(full=True)
        for img_index, img in enumerate(img_list):
            xref = img[0]
            try:
                pix = fitz.Pixmap(doc, xref)
                if pix.n > 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                img_rects = page.get_image_rects(xref)
                if not img_rects:
                    continue
                rect = img_rects[0]
                img_bytes = pix.tobytes("png")
                img_hash = hashlib.md5(img_bytes).hexdigest()
                images.append(ExtractedImage(
                    page_number=page_num + 1,
                    file_name=f"raster_p{page_num+1}_{img_index}.png",
                    file_path=None,
                    width=pix.width,
                    height=pix.height,
                    file_size_kb=len(img_bytes) / 1024,
                    aspect_ratio=pix.width / max(pix.height, 1),
                    bbox=[rect.x0, rect.y0, rect.x1, rect.y1],
                    image_hash=img_hash,
                    image_data=img_bytes
                ))
                pix = None
            except Exception:
                continue
        return images

    def _extract_vector_diagrams(self, page, page_num):
        """Extract vector diagrams by clustering PDF drawing paths."""
        drawings = page.get_drawings()
        if not drawings:
            return []

        rects = []
        for d in drawings:
            r = d.get('rect')
            if r and r.width > 3 and r.height > 3:
                rects.append(r)

        if not rects:
            return []

        clusters = self._cluster_rects(rects, threshold=25)
        images = []

        for cluster in clusters:
            if len(cluster) < 3:
                continue

            x0 = min(r.x0 for r in cluster)
            y0 = min(r.y0 for r in cluster)
            x1 = max(r.x1 for r in cluster)
            y1 = max(r.y1 for r in cluster)

            width = x1 - x0
            height = y1 - y0

            # Skip text-line-like clusters (long and thin)
            if width > 300 and height < 30:
                continue
            if width < 20 and height > 300:
                continue
            if width < 50 or height < 50:
                continue

            pad = 10
            rect = fitz.Rect(
                max(0, x0 - pad),
                max(0, y0 - pad),
                min(page.rect.width, x1 + pad),
                min(page.rect.height, y1 + pad)
            )

            try:
                mat = fitz.Matrix(2, 2)
                pix = page.get_pixmap(matrix=mat, clip=rect)
                img_bytes = pix.tobytes("png")
                img_hash = hashlib.md5(img_bytes).hexdigest()
                images.append(ExtractedImage(
                    page_number=page_num + 1,
                    file_name=f"vector_p{page_num+1}_{len(images)}.png",
                    file_path=None,
                    width=pix.width,
                    height=pix.height,
                    file_size_kb=len(img_bytes) / 1024,
                    aspect_ratio=pix.width / max(pix.height, 1),
                    bbox=[rect.x0, rect.y0, rect.x1, rect.y1],
                    image_hash=img_hash,
                    image_data=img_bytes
                ))
                pix = None
            except Exception:
                continue

        return images

    def _cluster_rects(self, rects, threshold=25):
        """Cluster rectangles by spatial proximity using union-find."""
        if not rects:
            return []

        n = len(rects)
        parent = list(range(n))

        def find(x):
            if parent[x] != x:
                parent[x] = find(parent[x])
            return parent[x]

        def union(x, y):
            px, py = find(x), find(y)
            if px != py:
                parent[px] = py

        for i in range(n):
            for j in range(i + 1, n):
                r1, r2 = rects[i], rects[j]
                expanded = fitz.Rect(r1.x0 - threshold, r1.y0 - threshold, r1.x1 + threshold, r1.y1 + threshold)
                if expanded.intersects(r2):
                    union(i, j)

        clusters = defaultdict(list)
        for i in range(n):
            clusters[find(i)].append(rects[i])

        return list(clusters.values())

    def _deduplicate_images(self, images):
        """Remove overlapping raster/vector duplicates. Keep larger."""
        if not images:
            return images
        images.sort(key=lambda x: x.width * x.height, reverse=True)
        result = []
        for img in images:
            overlap = False
            for existing in result:
                i_rect = fitz.Rect(img.bbox)
                e_rect = fitz.Rect(existing.bbox)
                inter = i_rect & e_rect
                if inter and inter.get_area() > 0.6 * min(i_rect.get_area(), e_rect.get_area()):
                    overlap = True
                    break
            if not overlap:
                result.append(img)
        return result

    def _get_text_blocks(self, page):
        blocks = []
        for b in page.get_text("blocks"):
            blocks.append({'bbox': [b[0], b[1], b[2], b[3]], 'text': b[4]})
        return blocks

    def get_summary(self, records=None):
        records = records or self.records
        relevant = [r for r in records if not r.get('is_noise')]
        by_type = defaultdict(int)
        by_question = defaultdict(int)
        for r in relevant:
            by_type[r.get('attachment_type', 'unknown')] += 1
            q = r.get('linked_question_number') or 'unlinked'
            by_question[q] += 1
        total = len(records)
        noise = total - len(relevant)
        avg_rel = sum(r.get('relevance_score', 0) for r in relevant) / max(len(relevant), 1)
        return {
            'total_images': total,
            'noise_filtered': noise,
            'relevant_attachments': len(relevant),
            'primary_attachments': len([r for r in relevant if not r.get('is_inherited')]),
            'avg_relevance': round(avg_rel, 2),
            'by_type': dict(by_type),
            'by_question': dict(by_question)
        }


# ============================================================
# ANCHOR EXTRACTION
# ============================================================

def extract_anchors(pdf_path: str):
    import re
    doc = fitz.open(pdf_path)
    anchors = []
    pattern = re.compile(r'(?<!\d)(\d+(?:\.\d+)+)(?!\d|\.)')
    for pnum, page in enumerate(doc, 1):
        text = page.get_text()
        for m in pattern.finditer(text):
            if not _valid_qnum(m.group(1), text):
                continue
            b = page.search_for(m.group(1))
            if not b:
                continue
            b = b[0]
            anchors.append({
                'question_number': m.group(1),
                'page_number': pnum,
                'y_position': b[1],
                'x_position': b[0],
                'is_header': m.group(1).count('.') == 1,
                'header_level': m.group(1).count('.'),
                'parent_question': None,
                'has_sub_items': False
            })
    doc.close()
    seen = set()
    unique = []
    for a in anchors:
        k = (a['question_number'], a['page_number'])
        if k not in seen:
            seen.add(k)
            unique.append(a)
    for a in unique:
        parts = a['question_number'].split('.')
        if len(parts) > 2:
            a['parent_question'] = '.'.join(parts[:2])
        elif len(parts) == 2:
            a['has_sub_items'] = any(
                x['question_number'].startswith(a['question_number'] + '.') and
                x['question_number'] != a['question_number']
                for x in unique
            )
    return unique

def _valid_qnum(match: str, text: str) -> bool:
    idx = text.find(match)
    if idx == 0:
        return True
    if idx > 0 and text[idx-1] in ' \n\t([':
        return True
    end = idx + len(match)
    if end < len(text) and text[end] in ' \n\t.)[;':
        return True
    return False


# ============================================================
# TEST RUNNER
# ============================================================

def run_test(pdf_path: str, output_dir: str = "./attachment_output", debug: bool = False):
    os.makedirs(output_dir, exist_ok=True)
    print(f"\n{'='*60}")
    print(f"ATTACHMENT PARSER TEST — {os.path.basename(pdf_path)}")
    print(f"{'='*60}")

    anchors = extract_anchors(pdf_path)
    print(f"Found {len(anchors)} question anchors")

    parser = AttachmentParser()
    records = parser.parse_pdf(pdf_path, anchors,
                               paper_code=os.path.basename(pdf_path).replace('.pdf', ''))
    summary = parser.get_summary(records)

    print(f"\n{'-'*60}")
    print("SUMMARY")
    print(f"{'-'*60}")
    print(f"Total images extracted:     {summary['total_images']}")
    print(f"Noise filtered:             {summary['noise_filtered']}")
    print(f"Relevant attachments:       {summary['relevant_attachments']}")
    print(f"Primary attachments:        {summary['primary_attachments']}")
    print(f"Average relevance score:    {summary['avg_relevance']}")
    print(f"\nBy type:")
    for t, c in sorted(summary['by_type'].items()):
        print(f"  {t:15s}: {c}")
    print(f"\nBy question (top 15):")
    for q, c in sorted(summary['by_question'].items(), key=lambda x: -x[1])[:15]:
        qs = q or 'unlinked'
        print(f"  {qs:15s}: {c}")

    relevant = [r for r in records if not r.get('is_noise')]

    if debug:
        print(f"\n{'-'*60}")
        print("IMAGE DETAILS (debug)")
        print(f"{'-'*60}")
        for r in relevant:
            q = r.get('linked_question_number') or 'UNLINKED'
            print(f"  Page {r['page_number']:2d} | {r['file_name']:30s} | {r['image_width']:4d}x{r['image_height']:4d} | {r['file_size_kb']:6.1f}KB | q={q:10s} | rel={r['relevance_score']:.2f} | type={r['attachment_type']}")
        print(f"{'-'*60}")

    print(f"\nSaving {len(relevant)} relevant images to {output_dir}...")
    for i, rec in enumerate(relevant):
        qn = rec.get('linked_question_number') or 'unlinked'
        safe = qn.replace('.', '_')
        fname = f"{safe}_{i:03d}_{rec['file_name']}"
        with open(os.path.join(output_dir, fname), 'wb') as f:
            f.write(rec['image_data'])

    meta = os.path.join(output_dir, 'attachment_metadata.json')
    with open(meta, 'w', encoding='utf-8') as f:
        json.dump({
            'pdf_file': pdf_path,
            'summary': summary,
            'attachments': [{k: v for k, v in r.items() if k != 'image_data'} for r in records]
        }, f, indent=2, default=str)
    print(f"Metadata saved to: {meta}")
    print(f"\n{'='*60}\nTEST COMPLETE\n{'='*60}")
    return records, summary


# ============================================================
# JSON MODE
# ============================================================

def run_json_mode(pdf_path: str, paper_code: str):
    data = sys.stdin.read()
    try:
        anchors = json.loads(data) if data.strip() else []
    except json.JSONDecodeError:
        anchors = []

    parser = AttachmentParser()
    records = parser.parse_pdf(pdf_path, anchors, paper_code)
    summary = parser.get_summary(records)

    for r in records:
        if 'image_data' in r:
            r['image_data'] = base64.b64encode(r['image_data']).decode('utf-8')

    print(f"ATTACHMENT_JSON_OUTPUT:{json.dumps({'success': True, 'summary': summary, 'records': records})}")


# ============================================================
# CLI
# ============================================================

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='QBank Attachment Parser v2')
    ap.add_argument('--test', help='PDF path for standalone test')
    ap.add_argument('--output', default='./attachment_output', help='Output directory')
    ap.add_argument('--json-mode', action='store_true', help='JSON mode for Node.js')
    ap.add_argument('--pdf', help='PDF path (json-mode)')
    ap.add_argument('--paper-code', help='Paper code (json-mode)')
    ap.add_argument('--debug', action='store_true', help='Print detailed image info')
    args = ap.parse_args()

    if args.json_mode and args.pdf and args.paper_code:
        run_json_mode(args.pdf, args.paper_code)
    elif args.test:
        run_test(args.test, args.output, args.debug)
    else:
        ap.print_help()
