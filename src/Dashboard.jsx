import React from 'react';
import Sidebar from './components/Sidebar';

const Dashboard = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* 1. Permanent Sidebar */}
      <Sidebar />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Operational Overview</h2>
          <div className="flex items-center space-x-4">
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
              System Live
            </span>
            <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center font-bold text-white">
              AA
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;