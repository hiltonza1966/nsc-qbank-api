import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { itemsApi, papersApi } from '../services/api';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: () => itemsApi.list({ status: 'draft' })
  });

  const { data: pendingReviews } = useQuery({
    queryKey: ['pendingItems'],
    queryFn: itemsApi.pending
  });

  const { data: papers } = useQuery({
    queryKey: ['papers'],
    queryFn: () => papersApi.list({ status: 'draft' })
  });

  const stats = [
    { label: 'Draft Items', value: items?.count || 0, color: 'bg-blue-500', link: '/items' },
    { label: 'Pending Reviews', value: pendingReviews?.count || 0, color: 'bg-orange-500', link: '/reviews' },
    { label: 'Draft Papers', value: papers?.count || 0, color: 'bg-purple-500', link: '/papers' },
    { label: 'Published Items', value: 0, color: 'bg-green-500', link: '/items' }
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <div className="grid grid-cols-4 gap-4">
        {stats.map(stat => (
          <Link key={stat.label} to={stat.link}>
            <div className={`${stat.color} text-white rounded-lg p-6 hover:opacity-90 transition-opacity`}>
              <p className="text-3xl font-bold">{stat.value}</p>
              <p className="text-sm mt-1">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-4">Recent Items</h3>
          <div className="space-y-2">
            {items?.items?.slice(0, 5).map((item: any) => (
              <div key={item.item_id} className="flex justify-between p-2 border-b">
                <div>
                  <p className="text-sm font-medium">{item.item_code}</p>
                  <p className="text-xs text-gray-500">{item.subject_name}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-gray-100 rounded">{item.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-4">Recent Papers</h3>
          <div className="space-y-2">
            {papers?.papers?.slice(0, 5).map((paper: any) => (
              <div key={paper.paper_id} className="flex justify-between p-2 border-b">
                <div>
                  <p className="text-sm font-medium">{paper.paper_title}</p>
                  <p className="text-xs text-gray-500">{paper.total_marks} marks</p>
                </div>
                <span className="text-xs px-2 py-1 bg-gray-100 rounded">{paper.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
