import React from 'react';
import { Search } from 'lucide-react';

export function SearchBar() {
  return (
    <div className="max-w-2xl mx-auto w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search papers, topics, or authors..."
          className="w-full pl-10 pr-4 py-3 rounded-full border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all bg-white/90 backdrop-blur-sm"
        />
      </div>
    </div>
  );
}