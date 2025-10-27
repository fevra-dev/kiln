'use client';

/**
 * Documentation Index Page
 * 
 * Desktop-style window manager for documentation
 * Draggable, resizable windows for each document
 * 
 * @description Documentation hub for Kiln-Teleburn Protocol
 * @version 0.1.1
 */

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { DocumentWindow } from '@/components/docs/DocumentWindow';
import { marked } from 'marked';

interface DocLink {
  path: string;
  title: string;
  description: string;
  category: 'core' | 'guides';
}

const DOCS: DocLink[] = [
  // Core User Documentation
  {
    path: '/README.md',
    title: 'Getting Started',
    description: 'Complete project overview, setup, and usage guide',
    category: 'core',
  },
  {
    path: '/docs/TELEBURN_SUMMARY.md',
    title: 'What is Teleburn?',
    description: 'Simple explanation of the teleburn protocol and its benefits',
    category: 'core',
  },
  {
    path: '/docs/TELEBURN_ALGORITHM.md',
    title: 'How It Works',
    description: 'Technical explanation of the SHA-256 derivation algorithm',
    category: 'core',
  },
  
  // User Guides
  {
    path: '/docs/API_REFERENCE.md',
    title: 'API Reference',
    description: 'Complete API documentation for developers',
    category: 'guides',
  },
  {
    path: '/docs/INTEGRATION_GUIDE.md',
    title: 'Integration Guide',
    description: 'Step-by-step integration instructions',
    category: 'guides',
  },
];

const CATEGORIES = {
  core: { label: 'Core Documentation', icon: '🔥' },
  guides: { label: 'User Guides', icon: '📚' },
};

interface OpenWindow {
  id: string;
  doc: DocLink;
  content: string;
  htmlContent: string;
}

export default function DocsPage() {
  const searchParams = useSearchParams();
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);
  const [topZIndex, setTopZIndex] = useState(1000);
  const [windowZIndices, setWindowZIndices] = useState<Record<string, number>>({});
  const [hasOpenedFromUrl, setHasOpenedFromUrl] = useState(false);

  const groupedDocs = DOCS.reduce((acc, doc) => {
    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, DocLink[]>);

  const handleOpenDoc = async (doc: DocLink) => {
    // Check if window is already open
    const existingWindow = openWindows.find(w => w.doc.path === doc.path);
    if (existingWindow) {
      // Bring to front
      handleFocusWindow(existingWindow.id);
      return;
    }

    // Fetch document content
    try {
      const response = await fetch(doc.path);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const content = await response.text();
      
      if (!content || content.trim().length === 0) {
        throw new Error('Document is empty');
      }
      
      console.log('Loaded document:', doc.title, 'Length:', content.length);
      
      // Parse markdown to HTML
      const htmlContent = await marked.parse(content);
      
      const newWindow: OpenWindow = {
        id: `window-${Date.now()}`,
        doc,
        content,
        htmlContent,
      };

      setOpenWindows(prev => [...prev, newWindow]);
      const newZIndex = topZIndex + 1;
      setTopZIndex(newZIndex);
      setWindowZIndices(prev => ({ ...prev, [newWindow.id]: newZIndex }));
    } catch (error) {
      console.error('Failed to load document:', doc.path, error);
      
      // Create error window
      const errorContent = `# Error Loading Document\n\nFailed to load **${doc.title}**\n\nPath: \`${doc.path}\`\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\n## Troubleshooting\n\n1. Check if the file exists in the repository\n2. Verify the file path is correct\n3. Ensure the file is accessible from the web server`;
      
      const htmlContent = await marked.parse(errorContent);
      
      const newWindow: OpenWindow = {
        id: `window-${Date.now()}`,
        doc: { ...doc, title: `Error: ${doc.title}` },
        content: errorContent,
        htmlContent,
      };

      setOpenWindows(prev => [...prev, newWindow]);
      const newZIndex = topZIndex + 1;
      setTopZIndex(newZIndex);
      setWindowZIndices(prev => ({ ...prev, [newWindow.id]: newZIndex }));
    }
  };

  const handleCloseWindow = (id: string) => {
    setOpenWindows(prev => prev.filter(w => w.id !== id));
    setWindowZIndices(prev => {
      const newIndices = { ...prev };
      delete newIndices[id];
      return newIndices;
    });
  };

  const handleFocusWindow = (id: string) => {
    const newZIndex = topZIndex + 1;
    setTopZIndex(newZIndex);
    setWindowZIndices(prev => ({ ...prev, [id]: newZIndex }));
  };

  // Handle URL parameters to auto-open specific documents
  useEffect(() => {
    const docParam = searchParams.get('doc');
    if (docParam && !hasOpenedFromUrl) {
      const doc = DOCS.find(d => d.path === docParam);
      if (doc) {
        setHasOpenedFromUrl(true);
        handleOpenDoc(doc);
      }
    }
  }, [searchParams, hasOpenedFromUrl]);

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono p-6 pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-4">
            {/* Home Button */}
            <a 
              href="/" 
              className="home-button text-4xl hover:text-matrix-red transition-colors duration-200"
              title="Return to KILN Home"
            >
              ঌ
            </a>
            <h1 className="text-4xl font-bold text-terminal-text glow-text">
              [ Kiln Teleburn Documentation ]
            </h1>
          </div>
          <p className="text-lg text-matrix-red/80 mb-2">
            <span className="text-terminal-prompt">$</span> Documentation Index
          </p>
          <p className="text-sm text-matrix-red/60">
            Complete technical documentation for the Kiln-Teleburn protocol
          </p>
        </div>

        {/* Quick Links */}
        <div className="terminal p-6 mb-8">
          <div className="text-sm text-matrix-red/60 mb-4">QUICK START</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link 
              href="/teleburn" 
              className="code-block hover:border-matrix-red transition-colors"
            >
              <div className="text-matrix-red font-bold mb-1">→ Launch Teleburn</div>
              <div className="text-xs text-matrix-red/60">Start burning NFTs</div>
            </Link>
            <Link 
              href="/verify" 
              className="code-block hover:border-matrix-red transition-colors"
            >
              <div className="text-matrix-red font-bold mb-1">→ Verify Status</div>
              <div className="text-xs text-matrix-red/60">Check burn status</div>
            </Link>
            <a 
              href="https://github.com/fevra-dev" 
              target="_blank" 
              rel="noopener noreferrer"
              className="code-block hover:border-matrix-red transition-colors"
            >
              <div className="text-matrix-red font-bold mb-1">→ GitHub Repo</div>
              <div className="text-xs text-matrix-red/60">View source code</div>
            </a>
          </div>
        </div>

        {/* Documentation Tree */}
        <div className="terminal p-8">
          <div className="text-sm text-matrix-red/60 mb-6">
            <span className="text-terminal-prompt">$</span> tree ./docs
          </div>

          {Object.entries(groupedDocs).map(([category, docs]) => (
            <div key={category} className="mb-8 last:mb-0">
              <div className="flex items-center gap-2 mb-4 text-matrix-red font-bold">
                <span>{CATEGORIES[category as keyof typeof CATEGORIES].icon}</span>
                <span>{CATEGORIES[category as keyof typeof CATEGORIES].label}</span>
              </div>
              
              <div className="space-y-3 pl-6 border-l-2 border-matrix-red/30">
                {docs.map((doc, index) => (
                  <button
                    key={doc.path}
                    onClick={() => handleOpenDoc(doc)}
                    className="block group w-full text-left"
                  >
                    <div className="flex items-start gap-3 hover:bg-matrix-red/10 p-3 -ml-3 rounded transition-colors cursor-pointer">
                      <span className="text-matrix-red/60 mt-1">
                        {index === docs.length - 1 ? '└─' : '├─'}
                      </span>
                      <div className="flex-1">
                        <div className="text-matrix-red group-hover:text-glow-red font-mono mb-1">
                          {doc.title}
                        </div>
                        <div className="text-xs text-matrix-red/60">
                          {doc.description}
                        </div>
                        <div className="text-xs text-matrix-red/40 mt-1 font-mono">
                          {doc.path}
                        </div>
                      </div>
                      <span className="text-matrix-red/40 group-hover:text-matrix-red transition-colors">
                        ⊞
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-sm text-matrix-red/60">
          <div className="mb-2">
            All documentation is available in the project repository
          </div>
          <div className="font-mono">
            <span className="text-terminal-prompt">$</span> cat docs/*.md
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-8 text-center">
          <Link 
            href="/"
            className="inline-block px-6 py-3 border border-matrix-red text-matrix-red hover:bg-matrix-red hover:text-black transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>

      <style jsx>{`
        .glow-text {
          text-shadow: 0 0 10px rgba(255, 0, 0, 0.8);
        }

        .text-glow-red {
          text-shadow: 0 0 5px rgba(255, 0, 0, 0.6);
        }
      `}</style>

      {/* Render Open Windows */}
      {openWindows.map((window, index) => (
        <DocumentWindow
          key={window.id}
          id={window.id}
          title={window.doc.title}
          onClose={() => handleCloseWindow(window.id)}
          onFocus={() => handleFocusWindow(window.id)}
          zIndex={windowZIndices[window.id] || 1000}
          initialPosition={{
            x: 100 + (index * 30),
            y: 100 + (index * 30),
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: window.htmlContent }} />
        </DocumentWindow>
      ))}

      {/* Taskbar */}
      {openWindows.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/90 border-t border-matrix-red/30 p-2 backdrop-blur-sm z-[9999]">
          <div className="flex items-center gap-2 max-w-7xl mx-auto">
            <div className="text-xs text-matrix-red/60 mr-2">OPEN:</div>
            {openWindows.map((window) => (
              <button
                key={window.id}
                onClick={() => handleFocusWindow(window.id)}
                className="px-3 py-1.5 text-xs bg-matrix-red/10 border border-matrix-red/30 hover:bg-matrix-red/20 transition-colors rounded"
                style={{
                  borderColor: windowZIndices[window.id] === Math.max(...Object.values(windowZIndices)) 
                    ? 'var(--terminal-text)' 
                    : 'rgba(255, 0, 0, 0.3)',
                }}
              >
                {window.doc.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

