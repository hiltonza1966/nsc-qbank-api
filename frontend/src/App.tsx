import React from 'react';
import UploadWizard from './components/wizard/UploadWizard';

const App: React.FC = () => {
  return (
    <div className="app">
      <header className="app-header">
        <h1>QBank Corporate System</h1>
        <p>Question Paper Validation & Comparison Engine</p>
      </header>
      <main>
        <UploadWizard />
      </main>
    </div>
  );
};

export default App;
