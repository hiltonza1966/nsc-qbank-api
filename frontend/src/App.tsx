import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import ItemStudio from './pages/ItemStudio';
import ItemReview from './pages/ItemReview';
import PaperBuilder from './pages/PaperBuilder';
import PaperModeration from './pages/PaperModeration';
import Dashboard from './pages/Dashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2
    }
  }
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="items" element={<ItemStudio />} />
            <Route path="items/:itemId" element={<ItemStudio />} />
            <Route path="reviews" element={<ItemReview />} />
            <Route path="papers" element={<PaperBuilder />} />
            <Route path="papers/:paperId" element={<PaperBuilder />} />
            <Route path="moderation/:paperId" element={<PaperModeration />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
