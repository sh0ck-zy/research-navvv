import React from 'react';
import { ExternalLink } from 'lucide-react';

interface RecommendationCardProps {
  title: string;
  authors: string[];
  abstract: string;
  relevanceScore: number;
}

export function RecommendationCard({ 
  title, 
  authors, 
  abstract, 
  relevanceScore 
}: RecommendationCardProps) {
  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-semibold text-gray-900 flex-1">{title}</h3>
        <span className="ml-2 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
          {relevanceScore}%
        </span>
      </div>
      
      <p className="mt-1 text-sm text-gray-600">
        {authors.join(', ')}
      </p>
      
      <p className="mt-2 text-gray-700 line-clamp-2">
        {abstract}
      </p>
      
      <div className="mt-3 flex items-center text-sm text-blue-600 hover:text-blue-800">
        <ExternalLink size={16} className="mr-1" />
        View paper
      </div>
    </div>
  );
}