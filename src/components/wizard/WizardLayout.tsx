'use client';

/**
 * Wizard Layout Component
 * 
 * Container for multi-step teleburn wizard.
 * Shows progress, step indicators, and navigation.
 * Red matrix hacker theme with terminal aesthetics.
 * 
 * @description Main wizard container with step management
 * @version 0.1.1
 */

import { FC, ReactNode } from 'react';

export type WizardStep = 'connect' | 'preview' | 'execute';

interface WizardLayoutProps {
  currentStep: WizardStep;
  children: ReactNode;
  onStepChange?: (step: WizardStep) => void;
}

const STEPS: { id: WizardStep; label: string; description: string }[] = [
  { id: 'connect', label: '01_CONNECT', description: 'Initialize wallet connection' },
  { id: 'preview', label: '02_PREVIEW', description: 'Simulate transaction flow' },
  { id: 'execute', label: '03_EXECUTE', description: 'Broadcast to blockchain' },
];

/**
 * Wizard Layout Component
 * 
 * Manages step progression and displays current step content.
 */
export const WizardLayout: FC<WizardLayoutProps> = ({ 
  currentStep, 
  children,
  onStepChange 
}) => {
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  return (
    <div className="wizard-layout min-h-screen bg-terminal-bg text-terminal-text font-mono">
      {/* Header */}
      <div className="wizard-header border-b border-terminal-text/30 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <a 
                href="/" 
                className="text-3xl text-terminal-text glow-text hover:text-matrix-red transition-colors"
                title="Return to Home"
              >
                ঌ
              </a>
            </div>
            <div className="status-badge text-xs px-3 py-1 border border-terminal-text/30">
              MAINNET
            </div>
          </div>

          {/* Step Progress */}
          <div className="step-progress">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => {
                const isActive = step.id === currentStep;
                const isCompleted = index < currentStepIndex;
                const isUpcoming = index > currentStepIndex;

                return (
                  <div
                    key={step.id}
                    className={`step-item flex-1 ${
                      index < STEPS.length - 1 ? 'relative' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      {/* Step Circle */}
                      <button
                        onClick={() => onStepChange?.(step.id)}
                        disabled={isUpcoming}
                        className={`
                          w-10 h-10 rounded-full border-2 flex items-center justify-center
                          font-bold text-sm transition-all duration-200
                          ${isActive ? 'border-terminal-text bg-terminal-text text-black glow-border' : ''}
                          ${isCompleted ? 'border-terminal-text/50 bg-transparent text-terminal-text/50' : ''}
                          ${isUpcoming ? 'border-terminal-text/30 bg-transparent text-terminal-text/30 cursor-not-allowed' : ''}
                          ${!isUpcoming ? 'hover:scale-110' : ''}
                        `}
                      >
                        {isCompleted ? '✓' : index + 1}
                      </button>

                      {/* Step Label */}
                      <div className="ml-3">
                        <div className={`text-xs font-bold ${
                          isActive ? 'text-terminal-text' : 'text-terminal-text/50'
                        }`}>
                          {step.label}
                        </div>
                        <div className={`text-xs ${
                          isActive ? 'text-terminal-text/70' : 'text-terminal-text/40'
                        }`}>
                          {step.description}
                        </div>
                      </div>
                    </div>

                    {/* Connector Line */}
                    {index < STEPS.length - 1 && (
                      <div className="absolute top-5 left-10 right-0 h-0.5 bg-terminal-text/20 -z-10">
                        <div 
                          className={`h-full bg-terminal-text transition-all duration-300 ${
                            isCompleted ? 'w-full' : 'w-0'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="wizard-content p-6">
        <div className="max-w-6xl mx-auto">
          <div className="terminal-window">
            <div className="terminal-window-header">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-matrix-red animate-pulse-red"></div>
                <div className="w-3 h-3 rounded-full bg-matrix-red/50"></div>
                <div className="w-3 h-3 rounded-full bg-matrix-red/30"></div>
              </div>
              <div className="text-xs opacity-50">
                {STEPS[currentStepIndex]?.label} {/* {STEPS[currentStepIndex]?.description} */}
              </div>
            </div>
            <div className="terminal-window-content p-8">
              {children}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .glow-text {
          text-shadow: 0 0 10px rgba(255, 0, 0, 0.8);
        }

        .glow-border {
          box-shadow: 0 0 20px rgba(255, 0, 0, 0.6);
        }

        .terminal-badge {
          padding: 0.5rem 1rem;
          background: rgba(255, 0, 0, 0.1);
          border: 1px solid var(--terminal-text);
          font-size: 0.75rem;
          letter-spacing: 0.1em;
        }

        .terminal-window {
          background: rgba(0, 0, 0, 0.8);
          border: 1px solid var(--terminal-text);
          box-shadow: 0 0 30px rgba(255, 0, 0, 0.3);
          backdrop-filter: blur(10px);
        }

        .terminal-window-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid var(--terminal-text)/30;
          background: rgba(255, 0, 0, 0.05);
        }

        .terminal-window-content {
          min-height: 400px;
        }
      `}</style>
    </div>
  );
};

