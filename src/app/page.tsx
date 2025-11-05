/**
 * KILN-0.1.1 TELEBURN PROTOCOL
 * 
 * @description Red Matrix Hacker Interface - Cypherpunk Edition
 * @version 0.1.1
 * @classification [UNCLASSIFIED]
 */

'use client';

import { useState, useEffect, useMemo } from 'react';

export default function HomePage() {
  const [bootComplete, setBootComplete] = useState(false);
  const [passwordEntered, setPasswordEntered] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const handlePasswordSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (password === 'iceland') {
      setPasswordEntered(true);
      setPasswordError(false);
      // Start boot sequence after typing animation completes
      setTimeout(() => setBootComplete(true), 8000);
    } else {
      setPasswordError(true);
      setPassword('');
    }
  };

  return (
    <main className="min-h-screen bg-black text-matrix-red font-mono relative overflow-hidden w-full max-w-full">
      {/* Password Entry */}
      {!passwordEntered && (
        <PasswordEntry 
          password={password}
          setPassword={setPassword}
          onSubmit={handlePasswordSubmit}
          error={passwordError}
        />
      )}
      
      {/* Boot Sequence */}
      {passwordEntered && !bootComplete && <BootSequence />}
      
      {/* Main Interface */}
      {bootComplete && (
        <div className="relative z-10 animate-fade-in">
          <div className="animate-slide-up">
          <Header />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <TerminalInterface />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
            <FeaturesSection />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: '300ms' }}>
          <Footer />
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * Password Entry Component
 */
function PasswordEntry({ 
  password, 
  setPassword, 
  onSubmit, 
  error 
}: { 
  password: string; 
  setPassword: (password: string) => void; 
  onSubmit: (e: React.FormEvent) => void; 
  error: boolean; 
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="text-matrix-red font-mono text-center space-y-4">
        <div className="text-6xl mb-8">
          ঌ
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="access code"
              className="bg-black border border-matrix-red/30 text-matrix-red px-3 py-2 font-mono text-center focus:outline-none focus:border-matrix-red focus:ring-1 focus:ring-matrix-red/50 w-48"
              autoFocus
            />
          </div>
          {error && (
            <div className="text-red-500 text-xs">
              denied
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

/**
 * Boot Sequence Animation with Typing Effect
 */
function BootSequence() {
  const [currentLine, setCurrentLine] = useState(0);
  const [displayText, setDisplayText] = useState('');
  
  const messages = useMemo(() => [
    'INITIALIZING TELEBURN PROTOCOL...',
    'LOADING CRYPTOGRAPHIC MODULES...',
    'CONNECTING TO SOLANA MAINNET...',
    'CONNECTING TO BITCOIN NETWORK...',
    'SYSTEM READY'
  ], []);

  useEffect(() => {
    if (currentLine < messages.length) {
      const targetText = messages[currentLine];
      let charIndex = 0;
      
      const typeInterval = setInterval(() => {
        if (targetText && charIndex < targetText.length) {
          setDisplayText(targetText.substring(0, charIndex + 1));
          charIndex++;
        } else {
          clearInterval(typeInterval);
          setTimeout(() => {
            setCurrentLine(prev => prev + 1);
            setDisplayText('');
          }, 500);
        }
      }, 30);

      return () => clearInterval(typeInterval);
    }
    return undefined;
  }, [currentLine, messages]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="text-matrix-red font-mono space-y-2">
        {messages.slice(0, currentLine).map((message, index) => (
          <div key={index} className="terminal-prompt">{message}</div>
        ))}
        {currentLine < messages.length && (
        <div className="terminal-prompt flex items-center gap-2">
            {displayText}
            <span className="cursor animate-pulse"></span>
        </div>
        )}
      </div>
    </div>
  );
}

/**
 * Header Component
 */
function Header() {
  return (
    <header className="border-b border-matrix-red/30 bg-matrix-black/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="ascii-art text-xs kiln-version-box">
{`╔══════════════╗
║  KILN  v0.1.1  ║
╚══════════════╝`}
            </div>
          </div>
          
          {/* Status Indicators */}
          <div className="flex items-center gap-4">
            <div className="status-badge">
              <span>ONLINE</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * Terminal Interface Component
 */
function TerminalInterface() {
  return (
    <div>
      {/* Hero Terminal - Full Viewport */}
      <div className="min-h-screen px-4 py-8 flex flex-col justify-between w-full max-w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto w-full flex flex-col justify-between min-h-full">
          {/* Top Content */}
          <div className="terminal p-3 border-t-4 border-matrix-red">
            <div className="mb-2">
              <div className="text-3xl font-medium text-glow-red-lg mb-3 tracking-wide text-left">
                [ Kiln ঌ Teleburn ]
              </div>
              <div className="text-xl text-matrix-red/80 mb-1 text-left">
                {'>'} SOLANA → BITCOIN
              </div>
              <div className="text-xl text-matrix-red/80 mb-4 text-left">
                {'>'} TRUSTLESS ◎ PERMANENT ◉ PERMISSIONLESS
              </div>
          
              {/* Combined ASCII Art - KILN with Integrated Flame Effects */}
              <div className="ascii-art mb-3 text-center leading-tight font-bold flex justify-center ascii-art-container">
{`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║         (::)  ██╗  ██╗ ██╗ ██╗      ███╗   ██╗  (::)      ║
║         (:::) ██║ ██╔╝ ██║ ██║      ████╗  ██║ (:::)      ║
║         (:::) █████╔╝  ██║ ██║      ██╔██╗ ██║ (:::)      ║
║         (:::) ██╔═██╗  ██║ ██║      ██║╚██╗██║ (:::)      ║
║         (:::) ██║  ██╗ ██║ ███████╗ ██║ ╚████║ (:::)      ║
║         (:::) ╚═╝  ╚═╝ ╚═╝ ╚══════╝ ╚═╝  ╚═══╝ (:::)      ║
║                                                           ║
║                  ▓▒░ TELEBURN PROTOCOL ░▒▓                ║
║                                                           ║
║               [ FORGING CRYPTOGRAPHIC BURNS ]              ║
║                                                           ║
║               (  .      )                                 ║
║           )           (              )                    ║
║                 .  '   .   '  .  '  .                     ║
║        (    , )       (.   )  (   ',    )                 ║
║         .' ) ( . )    ,  ( ,     )   ( .                  ║
║      ). , ( .   (  ) ( , ')  .' (  ,    )                 ║
║     (_,) . ), ) _) _,')  (, ) '. )  ,. (' )               ║
║ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`}
          </div>
        </div>

        {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <a href="/teleburn" className="btn-matrix group">
            <span className="relative z-10">▶ INITIATE TELEBURN</span>
          </a>
          <a href="/verify" className="btn-matrix group">
                <span className="relative z-10">▶ VERIFY STATUS</span>
          </a>
        </div>
          </div>

          {/* Bottom System Info */}
          <div className="terminal p-3 border-b-4 border-matrix-red mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="code-block">
                <div className="text-matrix-red/60 mb-2">PROTOCOL</div>
                <div className="text-matrix-red">KILN v0.1.1</div>
          </div>
          <div className="code-block">
            <div className="text-matrix-red/60 mb-2">SECURITY</div>
            <div className="text-matrix-red">SHA-256 VERIFIED</div>
          </div>
          <div className="code-block">
            <div className="text-matrix-red/60 mb-2">STATUS</div>
            <div className="text-terminal-red">OFFLINE</div>
          </div>
        </div>
      </div>
        </div>
      </div>

    </div>
  );
}

/**
 * Features Section Component
 */
function FeaturesSection() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <FeatureCard
          icon="[✓]"
          title="INSCRIPTION VERIFICATION"
          description="Mandatory SHA-256 content verification. Prevents sealing to corrupted inscriptions."
          status="ACTIVE"
        />
        <FeatureCard
          icon="[⏱]"
          title="TEMPORAL ANCHORING"
          description="Block height + timestamp in all on-chain memos. Immutable proof of execution."
          status="ACTIVE"
        />
        <FeatureCard
          icon="[🔐]"
          title="DERIVED OWNER"
          description="Off-curve address derivation. Provably no private key exists. Irreversible."
          status="ACTIVE"
        />
        <FeatureCard
          icon="[🧪]"
          title="DRY RUN MODE"
          description="Full transaction simulation. Decode + simulate before signature. Zero risk."
          status="ACTIVE"
        />
        <FeatureCard
          icon="[🔍]"
          title="MULTI-RPC VERIFY"
          description="Cross-validation across multiple RPCs. Confidence scoring. High certainty."
          status="ACTIVE"
        />
        <FeatureCard
          icon="[⚡]"
          title="TOKEN-2022 COMPATIBLE"
          description="Extension detection. Automatic compatibility check. Prevents failed TX."
          status="ACTIVE"
        />
      </div>
    </div>
  );
}

/**
 * Feature Card Component
 */
interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  status: string;
}

function FeatureCard({ icon, title, description, status }: FeatureCardProps) {
  return (
    <div className="terminal p-6 hover:shadow-glow-red transition-shadow group">
      <div className="flex items-start gap-3 mb-3">
        <div className="text-2xl glow-text">{icon}</div>
        <div className="flex-1">
          <div className="font-bold text-matrix-red mb-1 uppercase tracking-wide">
            {title}
          </div>
          <div className="inline-flex items-center gap-2 px-2 py-1 border border-terminal-green/30 bg-terminal-green/10 text-xs">
            <span className="text-terminal-green">■</span>
            <span className="text-terminal-green">{status}</span>
          </div>
        </div>
      </div>
      <div className="text-sm text-matrix-red/70 leading-relaxed">
        {description}
      </div>
    </div>
  );
}

/**
 * Footer Component
 */
function Footer() {
  return (
    <footer className="border-t border-matrix-red/30 bg-matrix-black/50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="text-sm font-bold mb-3 text-matrix-red uppercase">Resources</div>
            <div className="space-y-2 text-sm text-matrix-red/60">
              <a href="/docs" className="block hover:text-matrix-red cursor-pointer">→ Documentation</a>
              <a href="/docs?doc=/README.md" className="block hover:text-matrix-red cursor-pointer">→ Getting Started</a>
              <a href="/docs?doc=/docs/TELEBURN_SUMMARY.md" className="block hover:text-matrix-red cursor-pointer">→ What is Teleburn</a>
              <a href="/docs?doc=/docs/TELEBURN_ALGORITHM.md" className="block hover:text-matrix-red cursor-pointer">→ How It Works</a>
            </div>
          </div>
          <div>
            <div className="text-sm font-bold mb-3 text-matrix-red uppercase">Quick Start</div>
            <div className="space-y-2 text-sm text-matrix-red/60">
              <a href="/teleburn" className="block hover:text-matrix-red cursor-pointer">→ Start Teleburn</a>
              <a href="/verify" className="block hover:text-matrix-red cursor-pointer">→ Verify Status</a>
            </div>
          </div>
          <div>
            <div className="text-sm font-bold mb-3 text-matrix-red uppercase">Network</div>
            <div className="space-y-2 text-sm text-matrix-red/60">
              <a href="https://github.com/fevra-dev" target="_blank" rel="noopener noreferrer" className="block hover:text-matrix-red cursor-pointer">→ GitHub</a>
              <a href="http://twitter.com/fevra_" target="_blank" rel="noopener noreferrer" className="block hover:text-matrix-red cursor-pointer">→ Twitter</a>
            </div>
          </div>
        </div>
        
        <div className="border-t border-matrix-red/20 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-matrix-red/60 font-mono">
            KILN v0.1.1
          </div>
          <div className="text-sm text-matrix-red/60 font-mono">
            BUILD.DATE: 2025-10-20
          </div>
        </div>
      </div>
    </footer>
  );
}
