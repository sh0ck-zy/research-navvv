import React from 'react';
import { Link } from 'react-router-dom';
import { StarField } from '../components/landing/StarField';
import { ArrowRight } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      <StarField />
      
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 text-center">
        <div className="animate-fade-in">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
            Research Navigator
          </h1>
          
          <p className="text-xl md:text-2xl mb-12 max-w-2xl text-gray-300">
            Explore the universe of knowledge. Connect ideas, discover patterns, and navigate through research like never before.
          </p>
          
          <Link
            to="/login"
            className="group relative inline-flex items-center px-8 py-3 text-lg font-medium rounded-full bg-white text-black hover:bg-opacity-90 transition-all"
          >
            Start Exploring
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}