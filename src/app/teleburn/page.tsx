'use client';

/**
 * Teleburn Wizard Page
 * 
 * Main page for KILN.1 teleburn protocol wizard.
 * Orchestrates complete multi-step flow with state management.
 * 
 * Flow:
 * 1. Input Form → Enter mint, inscription ID, SHA-256
 * 2. Connect Wallet → Connect Solana wallet
 * 3. Verify Inscription → SHA-256 content verification gate
 * 4. Preview → Dry run simulation
 * 5. Execute → Sign and broadcast transactions
 * 
 * @description Complete teleburn wizard interface
 * @version 0.1.1
 */

import { useState, useEffect } from 'react';
import { WizardLayout, WizardStep } from '@/components/wizard/WizardLayout';
import { TeleburnForm, TeleburnFormData } from '@/components/teleburn/TeleburnForm';
import { Step1Connect } from '@/components/wizard/Step1Connect';
import { Step2Verify } from '@/components/wizard/Step2Verify';
import { Step3Preview } from '@/components/wizard/Step3Preview';
import { Step4Execute } from '@/components/wizard/Step4Execute';
import { InscriptionVerificationResult } from '@/lib/types';

/**
 * Teleburn Wizard Page
 * 
 * Complete state management for wizard flow.
 */
export default function TeleburnPage() {
  const [currentStep, setCurrentStep] = useState<WizardStep>('connect');
  const [formData, setFormData] = useState<TeleburnFormData | null>(null);
  const [, setVerificationResult] = useState<InscriptionVerificationResult | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [isClient, setIsClient] = useState(false);

  // Ensure client-side rendering to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleFormSubmit = (data: TeleburnFormData) => {
    setFormData(data);
    setShowForm(false);
    setCurrentStep('connect');
  };

  const handleConnectComplete = () => {
    setCurrentStep('verify');
  };

  const handleVerifyComplete = (result: InscriptionVerificationResult) => {
    setVerificationResult(result);
    setCurrentStep('preview');
  };

  const handlePreviewComplete = () => {
    setCurrentStep('execute');
  };

  const handleExecuteComplete = () => {
    // Reset wizard to allow new teleburn
    setCurrentStep('connect');
    setFormData(null);
    setVerificationResult(null);
    setShowForm(false);
  };

  // Show loading state during hydration
  if (!isClient) {
    return null;
  }

  // Show form first if no data
  if (!formData || showForm) {
    return (
      <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <a 
                href="/" 
                className="home-button text-4xl hover:text-matrix-red transition-colors duration-200"
                title="Return to KILN Home"
              >
                ঌ
              </a>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-terminal-text glow-text whitespace-nowrap">
                [ Kiln Teleburn Protocol ]
              </h1>
            </div>
            <p className="text-lg text-matrix-red/80 mb-2">
              <span className="text-terminal-prompt">$</span> configure_teleburn_parameters
            </p>
            <p className="text-sm text-matrix-red/60">
              Configure your teleburn parameters to migrate Solana NFTs to Bitcoin Ordinals
            </p>
          </div>

          <div className="terminal-window">
            <div className="terminal-window-header">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-matrix-red animate-pulse-red"></div>
                <div className="w-3 h-3 rounded-full bg-matrix-red/50"></div>
                <div className="w-3 h-3 rounded-full bg-matrix-red/30"></div>
              </div>
              <div className="text-xs opacity-50">
                TELEBURN_CONFIG // Parameter Input
              </div>
            </div>
            <div className="terminal-window-content p-8">
              <TeleburnForm 
                onSubmit={handleFormSubmit}
                initialData={formData || undefined}
              />
            </div>
          </div>
        </div>

        <style jsx>{`
          .glow-text {
            text-shadow: 0 0 10px rgba(255, 0, 0, 0.8);
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
  }

  return (
    <WizardLayout 
      currentStep={currentStep}
      onStepChange={(step) => {
        // Only allow navigation to previous steps
        const steps: WizardStep[] = ['connect', 'verify', 'preview', 'execute'];
        const currentIndex = steps.indexOf(currentStep);
        const targetIndex = steps.indexOf(step);
        
        if (targetIndex < currentIndex) {
          setCurrentStep(step);
        }
      }}
    >
      {currentStep === 'connect' && (
        <Step1Connect onComplete={handleConnectComplete} />
      )}

      {currentStep === 'verify' && formData && (
        <Step2Verify
          inscriptionId={formData.inscriptionId}
          expectedSha256={formData.sha256}
          onComplete={handleVerifyComplete}
          onBack={() => setShowForm(true)}
        />
      )}

      {currentStep === 'preview' && formData && (
        <Step3Preview
          formData={formData}
          onComplete={handlePreviewComplete}
          onBack={() => setCurrentStep('verify')}
        />
      )}

      {currentStep === 'execute' && formData && (
        <Step4Execute
          formData={formData}
          onComplete={handleExecuteComplete}
          onBack={() => setCurrentStep('preview')}
        />
      )}
    </WizardLayout>
  );
}
