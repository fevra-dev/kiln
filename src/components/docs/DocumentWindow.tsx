'use client';

/**
 * Document Window Component
 * 
 * Draggable, resizable window for displaying documentation
 * Mimics classic desktop window managers
 * 
 * @description Desktop-style document viewer
 * @version 0.1.1
 */

import { FC, useState, useRef, useEffect, ReactNode } from 'react';

interface DocumentWindowProps {
  id: string;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onFocus: () => void;
  zIndex: number;
  initialPosition?: { x: number; y: number };
}

export const DocumentWindow: FC<DocumentWindowProps> = ({
  id,
  title,
  children,
  onClose,
  onFocus,
  zIndex,
  initialPosition = { x: 100, y: 100 },
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [preMaximizeState, setPreMaximizeState] = useState({ position, size });
  
  const windowRef = useRef<HTMLDivElement>(null);

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-header') && !isMaximized) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
      onFocus();
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragOffset]);

  // Handle maximize/restore
  const handleMaximize = () => {
    if (isMaximized) {
      setPosition(preMaximizeState.position);
      setSize(preMaximizeState.size);
      setIsMaximized(false);
    } else {
      setPreMaximizeState({ position, size });
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight - 100 });
      setIsMaximized(true);
    }
  };

  return (
    <div
      ref={windowRef}
      className="document-window"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex,
      }}
      onMouseDown={() => onFocus()}
    >
      {/* Window Header */}
      <div
        className="window-header"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
              title="Close"
            />
            <button
              onClick={handleMaximize}
              className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors"
              title="Maximize"
            />
            <button
              className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors"
              title="Minimize (disabled)"
            />
          </div>
          <div className="text-xs text-matrix-red/80 font-mono ml-2 select-none">
            {title}
          </div>
        </div>
      </div>

      {/* Window Content */}
      <div className="window-content">
        {children}
      </div>

      <style jsx>{`
        .document-window {
          background: rgba(0, 0, 0, 0.95);
          border: 1px solid var(--terminal-text);
          box-shadow: 0 0 30px rgba(255, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          display: flex;
          flex-direction: column;
          border-radius: 4px;
          overflow: hidden;
        }

        .window-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--terminal-text);
          background: rgba(255, 0, 0, 0.05);
          user-select: none;
        }

        .window-content {
          flex: 1;
          overflow: auto;
          padding: 2rem;
          color: var(--terminal-text);
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.9rem;
          line-height: 1.8;
          background: #000;
        }

        /* Markdown Styling */
        .window-content :global(h1) {
          font-size: 1.75rem;
          font-weight: bold;
          margin-top: 2rem;
          margin-bottom: 1rem;
          color: #ff0000;
          border-bottom: 2px solid rgba(255, 0, 0, 0.3);
          padding-bottom: 0.5rem;
        }

        .window-content :global(h2) {
          font-size: 1.4rem;
          font-weight: bold;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #ff0000;
        }

        .window-content :global(h3) {
          font-size: 1.1rem;
          font-weight: bold;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: rgba(255, 0, 0, 0.9);
        }

        .window-content :global(p) {
          margin-bottom: 1rem;
          color: rgba(255, 0, 0, 0.8);
        }

        .window-content :global(ul),
        .window-content :global(ol) {
          margin-left: 1.5rem;
          margin-bottom: 1rem;
          color: rgba(255, 0, 0, 0.8);
        }

        .window-content :global(li) {
          margin-bottom: 0.5rem;
        }

        .window-content :global(code) {
          background: rgba(255, 0, 0, 0.1);
          padding: 0.2rem 0.4rem;
          border-radius: 3px;
          font-size: 0.85rem;
          color: #ff0000;
        }

        .window-content :global(pre) {
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 0, 0, 0.3);
          padding: 1rem;
          border-radius: 4px;
          overflow-x: auto;
          margin-bottom: 1rem;
        }

        .window-content :global(pre code) {
          background: none;
          padding: 0;
          color: rgba(255, 0, 0, 0.9);
        }

        .window-content :global(blockquote) {
          border-left: 3px solid rgba(255, 0, 0, 0.5);
          padding-left: 1rem;
          margin-left: 0;
          margin-bottom: 1rem;
          color: rgba(255, 0, 0, 0.7);
          font-style: italic;
        }

        .window-content :global(a) {
          color: #ff0000;
          text-decoration: underline;
        }

        .window-content :global(a:hover) {
          color: #ff3333;
        }

        .window-content :global(hr) {
          border: none;
          border-top: 1px solid rgba(255, 0, 0, 0.3);
          margin: 1.5rem 0;
        }

        .window-content :global(table) {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1rem;
        }

        .window-content :global(th),
        .window-content :global(td) {
          border: 1px solid rgba(255, 0, 0, 0.3);
          padding: 0.5rem;
          text-align: left;
        }

        .window-content :global(th) {
          background: rgba(255, 0, 0, 0.1);
          font-weight: bold;
        }

        .window-content :global(strong) {
          font-weight: bold;
          color: #ff0000;
        }

        .window-content :global(em) {
          font-style: italic;
          color: rgba(255, 0, 0, 0.9);
        }

        /* Scrollbar styling */
        .window-content::-webkit-scrollbar {
          width: 8px;
        }

        .window-content::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
        }

        .window-content::-webkit-scrollbar-thumb {
          background: rgba(255, 0, 0, 0.3);
          border-radius: 4px;
        }

        .window-content::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 0, 0, 0.5);
        }
      `}</style>
    </div>
  );
};

