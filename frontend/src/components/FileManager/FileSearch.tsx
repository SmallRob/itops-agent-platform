import React, { useState, useRef, useEffect } from 'react';
import { SearchResult } from '../../types/fileManager';

interface FileSearchProps {
  results: SearchResult[];
  isSearching: boolean;
  onSearch: (query: string) => void;
  onClear: () => void;
  onSelectResult: (path: string) => void;
}

export default function FileSearch({
  results,
  isSearching,
  onSearch,
  onClear,
  onSelectResult,
}: FileSearchProps) {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
      setShowResults(true);
    }
  };

  const handleClear = () => {
    setQuery('');
    setShowResults(false);
    onClear();
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit} className="flex items-center gap-1">
        <div className="relative flex-1">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            🔍
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-7 pr-7 py-1.5 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-sm"
            >
              ✕
            </button>
          )}
        </div>
      </form>

      {showResults && (results.length > 0 || isSearching) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg max-h-64 overflow-auto z-50">
          {isSearching ? (
            <div className="p-3 text-center text-gray-400 text-sm">
              <div className="animate-spin inline-block w-4 h-4 border-b-2 border-blue-500 rounded-full mr-2"></div>
              Searching...
            </div>
          ) : (
            results.map((result, index) => (
              <button
                key={index}
                className="w-full px-3 py-2 text-left hover:bg-gray-700 flex items-center gap-2 text-sm"
                onClick={() => {
                  onSelectResult(result.path);
                  setShowResults(false);
                }}
              >
                <span>{result.type === 'directory' ? '📁' : '📄'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-gray-200 truncate">{result.name}</div>
                  <div className="text-xs text-gray-500 truncate">{result.path}</div>
                </div>
                {result.matches.length > 0 && (
                  <span className="text-xs text-gray-400 shrink-0">
                    {result.matches.length} match{result.matches.length > 1 ? 'es' : ''}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {showResults && !isSearching && query && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg p-3 text-center text-gray-400 text-sm z-50">
          No results found
        </div>
      )}
    </div>
  );
}
