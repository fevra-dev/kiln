/**
 * KILN TELEBURN PROTOCOL v1.0
 *
 * @description Red Matrix Hacker Interface - Cypherpunk Edition
 * @version 1.0
 * @classification [UNCLASSIFIED]
 */

'use client';

import { useState, useEffect, useMemo } from 'react';

export default function HomePage() {
  const [bootComplete, setBootComplete] = useState(false);

  // Scroll to top on mobile when page loads
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, []);

  // Run the boot sequence on load, then reveal the interface. The access-code
  // gate that used to precede this was removed for public launch — see
  // archive/password-gate/ to restore it.
  useEffect(() => {
    const timer = setTimeout(() => setBootComplete(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-black text-matrix-red font-mono relative overflow-hidden w-full max-w-full">
      {/* Boot Sequence */}
      {!bootComplete && <BootSequence />}

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
 * Boot Sequence Animation with Typing Effect
 */
function BootSequence() {
  const [currentLine, setCurrentLine] = useState(0);
  const [displayText, setDisplayText] = useState('');

  const messages = useMemo(
    () => [
      'INITIALIZING TELEBURN PROTOCOL...',
      'LOADING CRYPTOGRAPHIC MODULES...',
      'CONNECTING TO SOLANA MAINNET...',
      'CONNECTING TO BITCOIN NETWORK...',
      'SYSTEM READY',
    ],
    [],
  );

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
            setCurrentLine((prev) => prev + 1);
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
          <div key={index} className="terminal-prompt">
            {message}
          </div>
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
        <div className="flex items-center justify-end">
          {/* Status Indicator - Right aligned */}
          <div className="status-badge-online">
            <span className="pulse-dot"></span>
            <span>ONLINE</span>
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
      <div className="min-h-screen px-4 py-1 md:py-8 flex flex-col justify-start md:justify-center w-full max-w-full overflow-x-hidden landing-view">
        <div className="max-w-7xl mx-auto w-full">
          {/* Top Content */}
          <div className="terminal p-3 border-t-4 border-b-4 border-matrix-red mb-4">
            <div className="mb-2">
              <div className="text-3xl font-medium text-glow-red-lg mb-3 tracking-wide text-left">
                [ Kiln ঌ Teleburn ]
              </div>
              <div className="text-xl text-matrix-red/80 mb-1 text-left">
                {'>'} SOLANA → BITCOIN
              </div>
              <div className="text-xl text-matrix-red/80 mb-4 text-left">
                {'>'} PERMISSIONLESS ◎ TRUSTLESS ◉ PERMANENT
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
║               [ FORGING CRYPTOGRAPHIC BURNS ]             ║
║                                                           ║
║                      (  .      )                          ║
║                  )           (              )             ║
║                        .  '   .   '  .  '  .              ║
║               (    , )       (.   )  (   ',    )          ║
║                .' ) ( . )    ,  ( ,     )   ( .           ║
║             ). , ( .   (  ) ( , ')  .' (  ,    )          ║
║            (_,) . ), ) _) _,')  (, ) '. )  ,. (' )        ║
║          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^       ║
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
              <a href="/batch" className="btn-matrix group">
                <span className="relative z-10">▶ BATCH TELEBURN</span>
              </a>
              <a href="/verify" className="btn-matrix group">
                <span className="relative z-10">▶ VERIFY STATUS</span>
              </a>
              <a href="/history" className="btn-matrix group">
                <span className="relative z-10">▶ MY TELEBURNS</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom System Info - Below the fold */}
      <div className="w-full max-w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="terminal p-3 border-b-4 border-matrix-red">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="code-block">
                <div className="text-matrix-red/60 mb-2">PROTOCOL</div>
                <div className="text-matrix-red">KILN v1.0</div>
              </div>
              <div className="code-block">
                <div className="text-matrix-red/60 mb-2">SECURITY</div>
                <div className="text-matrix-red">NON-CUSTODIAL</div>
              </div>
              <div className="code-block">
                <div className="text-matrix-red/60 mb-2">STATUS</div>
                <div className="text-matrix-red">ONLINE</div>
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
          icon="[🔥]"
          title="ATOMIC BURN + MEMO"
          description="Burn and on-chain proof in a single transaction. ~78-byte teleburn: memo. One signature."
          status="ACTIVE"
        />
        <FeatureCard
          icon="[🧬]"
          title="MULTI-STANDARD"
          description="Regular NFTs, programmable NFTs (pNFT), and compressed NFTs (cNFT). One flow."
          status="ACTIVE"
        />
        <FeatureCard
          icon="[🛰]"
          title="DAS AUTO-DETECT"
          description="Helius DAS detects the asset standard and routes the correct burn path. No guesswork."
          status="ACTIVE"
        />
        <FeatureCard
          icon="[🧪]"
          title="DRY RUN MODE"
          description="Decode + simulate every transaction before signature. Full transparency. Zero surprise."
          status="ACTIVE"
        />
        <FeatureCard
          icon="[🔍]"
          title="PUBLIC VERIFICATION"
          description="Anyone can verify a teleburn on-chain at /verify. Solana memo ↔ Bitcoin inscription."
          status="ACTIVE"
        />
        <FeatureCard
          icon="[🔑]"
          title="NON-CUSTODIAL"
          description="Never handles private keys. The connecting wallet signs. Nothing auto-signed."
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
          <div className="font-bold text-matrix-red mb-1 uppercase tracking-wide">{title}</div>
          <div className="inline-flex items-center gap-2 px-2 py-1 border border-terminal-green/30 bg-terminal-green/10 text-xs">
            <span className="text-terminal-green">■</span>
            <span className="text-terminal-green">{status}</span>
          </div>
        </div>
      </div>
      <div className="text-sm text-matrix-red/70 leading-relaxed">{description}</div>
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
              <a href="/docs" className="block hover:text-matrix-red cursor-pointer">
                → Documentation
              </a>
              <a
                href="/docs?doc=/docs/USER_GUIDE.md"
                className="block hover:text-matrix-red cursor-pointer"
              >
                → User Guide (Start Here!)
              </a>
              <a
                href="/docs?doc=/docs/TELEBURN_SUMMARY.md"
                className="block hover:text-matrix-red cursor-pointer"
              >
                → What is Teleburn
              </a>
              <a
                href="/docs?doc=/docs/TELEBURN_SPEC_v1.0.md"
                className="block hover:text-matrix-red cursor-pointer"
              >
                → Technical Details
              </a>
            </div>
          </div>
          <div>
            <div className="text-sm font-bold mb-3 text-matrix-red uppercase">Quick Start</div>
            <div className="space-y-2 text-sm text-matrix-red/60">
              <a href="/teleburn" className="block hover:text-matrix-red cursor-pointer">
                → Start Teleburn
              </a>
              <a href="/verify" className="block hover:text-matrix-red cursor-pointer">
                → Verify Status
              </a>
              <a href="/history" className="block hover:text-matrix-red cursor-pointer">
                → My Teleburns
              </a>
            </div>
          </div>
          <div>
            <div className="text-sm font-bold mb-3 text-matrix-red uppercase">Network</div>
            <div className="space-y-2 text-sm text-matrix-red/60">
              <a
                href="https://github.com/fevra-dev"
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-matrix-red cursor-pointer"
              >
                → GitHub
              </a>
              <a
                href="http://twitter.com/fevra_"
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-matrix-red cursor-pointer"
              >
                → Twitter
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-matrix-red/20 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-matrix-red/60 font-mono">KILN v1.0</div>
          <div className="text-sm text-matrix-red/60 font-mono">BUILD.DATE: 2026-07-24</div>
        </div>
      </div>
    </footer>
  );
}
