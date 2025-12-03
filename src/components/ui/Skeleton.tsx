'use client';

/**
 * Skeleton Loading Component
 * 
 * Animated placeholder for loading states.
 * 
 * @description Skeleton loading animations
 * @version 0.1.1
 */

import { FC } from 'react';

interface SkeletonProps {
  /** Width (CSS value or 'full') */
  width?: string;
  /** Height (CSS value) */
  height?: string;
  /** Additional className */
  className?: string;
}

/**
 * Basic skeleton line
 */
export const Skeleton: FC<SkeletonProps> = ({ 
  width = '100%', 
  height = '1rem',
  className = ''
}) => {
  return (
    <div 
      className={`skeleton ${className}`}
      style={{ width, height }}
    >
      <style jsx>{`
        .skeleton {
          background: linear-gradient(
            90deg,
            rgba(255, 0, 0, 0.1) 0%,
            rgba(255, 0, 0, 0.2) 50%,
            rgba(255, 0, 0, 0.1) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 2px;
        }

        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
};

/**
 * Transaction preview skeleton
 */
export const TransactionSkeleton: FC = () => {
  return (
    <div className="tx-skeleton">
      <div className="tx-header">
        <Skeleton width="120px" height="1.5rem" />
        <Skeleton width="80px" height="1rem" />
      </div>
      <div className="tx-body">
        <Skeleton width="100%" height="0.875rem" />
        <Skeleton width="80%" height="0.875rem" />
        <Skeleton width="60%" height="0.875rem" />
      </div>

      <style jsx>{`
        .tx-skeleton {
          padding: 1.5rem;
          border: 1px solid rgba(255, 0, 0, 0.2);
          background: rgba(0, 0, 0, 0.4);
          margin-bottom: 1rem;
        }

        .tx-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(255, 0, 0, 0.1);
        }

        .tx-body {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
      `}</style>
    </div>
  );
};

/**
 * Full simulation preview skeleton
 */
export const SimulationSkeleton: FC = () => {
  return (
    <div className="simulation-skeleton">
      {/* Status header */}
      <div className="status-skeleton">
        <Skeleton width="200px" height="2rem" />
        <Skeleton width="100px" height="1.5rem" />
      </div>
      
      {/* Transaction cards */}
      <TransactionSkeleton />
      
      {/* Summary */}
      <div className="summary-skeleton">
        <div className="summary-row">
          <Skeleton width="100px" height="0.875rem" />
          <Skeleton width="60px" height="0.875rem" />
        </div>
        <div className="summary-row">
          <Skeleton width="120px" height="0.875rem" />
          <Skeleton width="80px" height="0.875rem" />
        </div>
      </div>

      <style jsx>{`
        .simulation-skeleton {
          padding: 1.5rem;
          border: 1px solid rgba(255, 0, 0, 0.3);
          background: rgba(0, 0, 0, 0.6);
        }

        .status-skeleton {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(255, 0, 0, 0.2);
        }

        .summary-skeleton {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 0, 0, 0.2);
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
};

