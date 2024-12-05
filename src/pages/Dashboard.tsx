import React from 'react';
import { TopBar } from '../components/lab/TopBar';
import { SearchBar } from '../components/lab/SearchBar';
import { FileUpload } from '../components/lab/FileUpload';
import { KnowledgeGraph } from '../components/graph/KnowledgeGraph';

const mockGraphData = {
  nodes: [
    { id: '1', title: 'Machine Learning', group: 1 },
    { id: '2', title: 'Deep Learning', group: 1 },
    { id: '3', title: 'Neural Networks', group: 1 },
    { id: '4', title: 'Computer Vision', group: 2 },
    { id: '5', title: 'Natural Language Processing', group: 2 },
  ],
  links: [
    { source: '1', target: '2', value: 1 },
    { source: '2', target: '3', value: 1 },
    { source: '1', target: '4', value: 1 },
    { source: '1', target: '5', value: 1 },
  ],
};

export function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopBar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <SearchBar />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 h-[600px]">
              <KnowledgeGraph data={mockGraphData} />
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
              <h2 className="text-lg font-semibold mb-4">Upload Papers</h2>
              <FileUpload />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
              <h2 className="text-lg font-semibold mb-4">Recommended Reading</h2>
              <div className="space-y-4">
                {/* Placeholder for recommendations */}
                <div className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <h3 className="font-medium">Understanding Deep Learning</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Based on your interests</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}