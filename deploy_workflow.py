import shutil
import os

# Source files (from the downloaded files)
src_reviewer = r'C:\dev\nsc-qbank\ReviewerDashboard.tsx'
src_admin = r'C:\dev\nsc-qbank\AdminAssignmentPanel.tsx'

# Destinations
dst_reviewer = r'C:\dev\nsc-qbank\frontend\src\pages\ReviewerDashboard.tsx'
dst_admin = r'C:\dev\nsc-qbank\frontend\src\pages\AdminAssignmentPanel.tsx'
app_tsx = r'C:\dev\nsc-qbank\frontend\src\App.tsx'

# Copy files
shutil.copy2(src_reviewer, dst_reviewer)
print(f'Copied ReviewerDashboard.tsx to {dst_reviewer}')

shutil.copy2(src_admin, dst_admin)
print(f'Copied AdminAssignmentPanel.tsx to {dst_admin}')

# Fix App.tsx
with open(app_tsx, 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
import_block = "import ReviewerDashboard from './pages/ReviewerDashboard';\nimport AdminAssignmentPanel from './pages/AdminAssignmentPanel';"

if 'ReviewerDashboard' not in content:
    lines = content.split('\n')
    import_idx = -1
    for i, line in enumerate(lines):
        if line.startswith('import ') and 'from' in line:
            import_idx = i
    if import_idx >= 0:
        lines.insert(import_idx + 1, import_block)
        content = '\n'.join(lines)
        print('Added imports to App.tsx')

# Add routes
route_block = '<Route path="/reviewer-dashboard" element={<ReviewerDashboard />} />\n        <Route path="/admin/assignments" element={<AdminAssignmentPanel />} />'

if 'reviewer-dashboard' not in content:
    content = content.replace('</Routes>', route_block + '\n      </Routes>')
    print('Added routes to App.tsx')

with open(app_tsx, 'w', encoding='utf-8') as f:
    f.write(content)

print('App.tsx updated successfully')
print('Done! Now run: cd C:\\dev\\nsc-qbank\\frontend && npm run build')
