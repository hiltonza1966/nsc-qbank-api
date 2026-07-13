const fs = require('fs');

const filePath = process.argv[2];
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// =============================================================================
// FIX 1: Add QP Image Gallery inline above the Question Text label in CRUD panel
// =============================================================================
const questionTextLabel = `<label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 'bold' }}>Question Text</label>`;
const qtIdx = content.indexOf(questionTextLabel);
if (qtIdx === -1) {
  console.error('ERROR: Question Text label not found');
  process.exit(1);
}
console.log('Found Question Text label at position:', qtIdx);

const qpGallery = `
                  {/* QP Image Gallery - Inline with Question */}
                  {(() => {
                    const qpImages = itemAttachments.filter((att) => att.file_path && att.file_path.includes('qp_images'));
                    if (qpImages.length === 0) return null;
                    return (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#1d4ed8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>📄</span> QP Diagrams / Images ({qpImages.length})
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {qpImages.map((att) => (
                            <div key={att.attachment_id} style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '6px', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                              <img
                                src={\`http://localhost:4000/uploads/\${att.file_path}\`}
                                alt={att.file_name}
                                style={{ width: '200px', height: 'auto', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px', cursor: 'pointer', display: 'block' }}
                                onClick={() => window.open(\`http://localhost:4000/uploads/\${att.file_path}\`, '_blank')}
                                title={\`Click to view full size: \${att.file_name}\`}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                              <div style={{ fontSize: '9px', color: '#6b7280', textAlign: 'center', marginTop: '4px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {att.file_name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
`;

const contentWithGallery = content.substring(0, qtIdx) + qpGallery + content.substring(qtIdx);
console.log('Inserted QP Image Gallery before Question Text');

// =============================================================================
// FIX 2: Replace the Attachments Section with view-only display
// =============================================================================
const startMarker = '                  {/* Attachments Section */}';
const startIdx = contentWithGallery.indexOf(startMarker);
if (startIdx === -1) {
  console.error('ERROR: Attachments Section not found');
  process.exit(1);
}
console.log('Found Attachments Section at position:', startIdx);

const loadingMarker = "{attachmentLoading && <div style={{ fontSize: '11px', color: '#6b7280' }}>Loading attachments...</div>}";
const loadingIdx = contentWithGallery.indexOf(loadingMarker, startIdx);
if (loadingIdx === -1) {
  console.error('ERROR: Loading marker not found');
  process.exit(1);
}

const endDivIdx = contentWithGallery.indexOf('</div>', loadingIdx + loadingMarker.length);
if (endDivIdx === -1) {
  console.error('ERROR: Closing </div> not found');
  process.exit(1);
}
const endPos = endDivIdx + '</div>'.length;

const oldSection = contentWithGallery.substring(startIdx, endPos);
console.log('Old section length:', oldSection.length);

const newSection = `                  {/* Attachments Section */}
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>📎 All Attachments</div>

                  {itemAttachments.length === 0 && !attachmentLoading && (
                    <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>No attachments for this item.</div>
                  )}

                  {itemAttachments.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(() => {
                        const qpAttachments = itemAttachments.filter((att) => att.file_path && att.file_path.includes('qp_images'));
                        const memoAttachments = itemAttachments.filter((att) => att.file_path && att.file_path.includes('memo_images'));
                        const otherAttachments = itemAttachments.filter((att) => !att.file_path || (!att.file_path.includes('qp_images') && !att.file_path.includes('memo_images')));

                        return (
                          <>
                            {qpAttachments.length > 0 && (
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '600', color: '#1d4ed8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span>📄</span> QP Images ({qpAttachments.length})
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {qpAttachments.map((att) => (
                                    <div key={att.attachment_id} style={{ position: 'relative', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px', background: '#f9fafb' }}>
                                      <img
                                        src={\`http://localhost:4000/uploads/\${att.file_path}\`}
                                        alt={att.file_name}
                                        style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '4px', cursor: 'pointer' }}
                                        onClick={() => window.open(\`http://localhost:4000/uploads/\${att.file_path}\`, '_blank')}
                                        title={\`Click to view full size: \${att.file_name}\`}
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                      />
                                      <div style={{ fontSize: '8px', color: '#6b7280', textAlign: 'center', marginTop: '2px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {att.file_name}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {memoAttachments.length > 0 && (
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '600', color: '#047857', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span>📝</span> Memo Images ({memoAttachments.length})
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {memoAttachments.map((att) => (
                                    <div key={att.attachment_id} style={{ position: 'relative', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px', background: '#f9fafb' }}>
                                      <img
                                        src={\`http://localhost:4000/uploads/\${att.file_path}\`}
                                        alt={att.file_name}
                                        style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '4px', cursor: 'pointer' }}
                                        onClick={() => window.open(\`http://localhost:4000/uploads/\${att.file_path}\`, '_blank')}
                                        title={\`Click to view full size: \${att.file_name}\`}
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                      />
                                      <div style={{ fontSize: '8px', color: '#6b7280', textAlign: 'center', marginTop: '2px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {att.file_name}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {otherAttachments.length > 0 && (
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px' }}>
                                  Other Attachments ({otherAttachments.length})
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {otherAttachments.map((att) => (
                                    <div key={att.attachment_id} style={{ position: 'relative', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px', background: '#f9fafb' }}>
                                      <img
                                        src={\`http://localhost:4000/api/attachments/\${att.attachment_id}\`}
                                        alt={att.file_name}
                                        style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '4px', cursor: 'pointer' }}
                                        onClick={() => window.open(\`http://localhost:4000/api/attachments/\${att.attachment_id}\`, '_blank')}
                                        title={\`Click to view full size: \${att.file_name}\`}
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                      />
                                      <div style={{ fontSize: '8px', color: '#6b7280', textAlign: 'center', marginTop: '2px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {att.file_name}
                                      </div>
                                      <button
                                        onClick={() => deleteAttachment(att.attachment_id, 'image')}
                                        style={{ position: 'absolute', top: '2px', right: '2px', padding: '2px 6px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {attachmentLoading && <div style={{ fontSize: '11px', color: '#6b7280' }}>Loading attachments...</div>}`;

const newContent = contentWithGallery.substring(0, startIdx) + newSection + contentWithGallery.substring(endPos);

const backupPath = filePath + '.bak.embed_' + new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(backupPath, content);
console.log('Backup saved to:', backupPath);

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('SUCCESS: File updated!');
console.log('Changes:');
console.log('  1. QP Image Gallery inserted above Question Text (200px thumbnails)');
console.log('  2. Attachments Section replaced with view-only grouped display (80px thumbnails)');
