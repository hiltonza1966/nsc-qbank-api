import React, { useState, useEffect } from 'react';
import { Users, BookOpen, CheckCircle, XCircle, Plus, Search, AlertCircle } from 'lucide-react';

interface User {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Subject {
  subject_id: string;
  subject_name: string;
  subject_alpha_code: string;
}

interface Assignment {
  assignment_id: number;
  user_id: string;
  subject_id: string;
  grade_id: string | null;
  is_primary_expert: number;
  full_name: string;
  email: string;
  role: string;
  subject_name: string;
  subject_alpha_code: string;
}

const AdminAssignmentPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    user_id: '',
    subject_id: '',
    grade_id: '',
    is_primary_expert: false
  });
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchSubjects();
    fetchAssignments();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) setUsers(data.users || []);
    } catch (e) { console.error(e); }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch('/api/subjects');
      const data = await res.json();
      if (data.success) setSubjects(data.subjects || []);
    } catch (e) { console.error(e); }
  };

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v2/review/assignments');
      const data = await res.json();
      if (data.success) setAssignments(data.assignments || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.user_id || !formData.subject_id) {
      setMessage({ type: 'error', text: 'Please select both user and subject' });
      return;
    }

    try {
      const res = await fetch('/api/v2/review/assign-subject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: formData.user_id,
          subject_id: formData.subject_id,
          grade_id: formData.grade_id || null,
          is_primary_expert: formData.is_primary_expert ? 1 : 0
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Assignment created successfully' });
        setFormData({ user_id: '', subject_id: '', grade_id: '', is_primary_expert: false });
        fetchAssignments();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create assignment' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network error' });
    }
  };

  const filteredAssignments = assignments.filter(a => 
    a.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'peer_reviewer': return 'bg-blue-100 text-blue-700';
      case 'subject_expert': return 'bg-purple-100 text-purple-700';
      case 'moderator': return 'bg-amber-100 text-amber-700';
      case 'chief_examiner': return 'bg-red-100 text-red-700';
      case 'examiner': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Subject Assignment Panel</h1>
          <p className="text-gray-600">Assign reviewers and experts to subjects for the workflow</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            New Assignment
          </h2>

          {message && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-4 items-end">
            <div className="col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reviewer / Expert</label>
              <select
                value={formData.user_id}
                onChange={(e) => setFormData({...formData, user_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select user...</option>
                {users.map(user => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.full_name} ({user.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <select
                value={formData.subject_id}
                onChange={(e) => setFormData({...formData, subject_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select subject...</option>
                {subjects.map(subject => (
                  <option key={subject.subject_id} value={subject.subject_id}>
                    {subject.subject_name} ({subject.subject_alpha_code})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade (optional)</label>
              <input
                type="text"
                value={formData.grade_id}
                onChange={(e) => setFormData({...formData, grade_id: e.target.value})}
                placeholder="e.g. 12"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_primary_expert}
                  onChange={(e) => setFormData({...formData, is_primary_expert: e.target.checked})}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Primary Expert</span>
              </label>
            </div>
            <div className="col-span-12">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Assignment
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Current Assignments ({assignments.length})
            </h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search assignments..."
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
              <span className="text-gray-500 text-sm">Loading assignments...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reviewer</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Grade</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Primary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAssignments.map((assignment) => (
                    <tr key={assignment.assignment_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                            {assignment.full_name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{assignment.full_name}</div>
                            <div className="text-xs text-gray-500">{assignment.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(assignment.role)}`}>
                          {assignment.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{assignment.subject_name}</span>
                          <span className="text-xs text-gray-500">({assignment.subject_alpha_code})</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">{assignment.grade_id || 'All'}</span>
                      </td>
                      <td className="px-6 py-4">
                        {assignment.is_primary_expert ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            <XCircle className="w-3 h-3" />
                            No
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredAssignments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p>No assignments found</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAssignmentPanel;
