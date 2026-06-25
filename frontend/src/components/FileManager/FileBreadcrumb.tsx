import React from 'react';

interface FileBreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
}

export default function FileBreadcrumb({ path, onNavigate }: FileBreadcrumbProps) {
  const segments = path.split('/').filter(Boolean);

  const buildPath = (index: number) => {
    return '/' + segments.slice(0, index + 1).join('/');
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 text-sm overflow-x-auto">
      <button
        className="px-1.5 py-0.5 rounded hover:bg-gray-700 text-gray-300 shrink-0"
        onClick={() => onNavigate('/')}
      >
        /
      </button>
      {segments.map((segment, index) => (
        <React.Fragment key={index}>
          <span className="text-gray-500 shrink-0">/</span>
          <button
            className={`px-1.5 py-0.5 rounded hover:bg-gray-700 shrink-0 ${
              index === segments.length - 1 ? 'text-white font-medium' : 'text-gray-300'
            }`}
            onClick={() => onNavigate(buildPath(index))}
          >
            {segment}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
