'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * BurnCelebration Component
 * Displays celebration animation and plays sound effects on successful teleburn
 */
interface BurnCelebrationProps {
  isActive: boolean;
  onComplete?: () => void;
}

// Fire particle for animation
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  life: number;
  color: string;
}

export function BurnCelebration({ isActive, onComplete }: BurnCelebrationProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showText, setShowText] = useState(false);

  /**
   * Play the celebration sound sequence
   * First: Superheat_Item.mp3 (burn sound)
   * Then: Unique_drop_sound_effect.ogg (success chime)
   */
  const playSounds = useCallback(() => {
    try {
      // First sound - the burn/superheat sound
      const burnSound = new Audio('/sfx/Superheat_Item.mp3');
      burnSound.volume = 0.6;
      
      // Second sound - the unique drop/success sound
      const successSound = new Audio('/sfx/Unique_drop_sound_effect.ogg');
      successSound.volume = 0.5;

      // Play burn sound first
      burnSound.play().catch(err => console.log('Audio play failed:', err));
      
      // Play success sound after burn sound (with slight overlap for better effect)
      setTimeout(() => {
        successSound.play().catch(err => console.log('Audio play failed:', err));
      }, 800);
    } catch (err) {
      console.log('Sound playback error:', err);
    }
  }, []);

  /**
   * Generate fire/ember particles
   */
  const generateParticles = useCallback(() => {
    const colors = ['#ff4400', '#ff6600', '#ff8800', '#ffaa00', '#ffcc00', '#ff0000'];
    const newParticles: Particle[] = [];
    
    for (let i = 0; i < 50; i++) {
      newParticles.push({
        id: i,
        x: 50 + (Math.random() - 0.5) * 20,
        y: 50,
        size: Math.random() * 12 + 4,
        speedX: (Math.random() - 0.5) * 4,
        speedY: -Math.random() * 6 - 2,
        life: Math.random() * 100 + 50,
        color: colors[Math.floor(Math.random() * colors.length)] || '#ff4400',
      });
    }
    
    return newParticles;
  }, []);

  useEffect(() => {
    if (isActive) {
      // Play sounds
      playSounds();
      
      // Generate particles
      setParticles(generateParticles());
      
      // Show celebration text after a brief delay
      setTimeout(() => setShowText(true), 300);
      
      // Animate particles
      const interval = setInterval(() => {
        setParticles(prev => 
          prev
            .map(p => ({
              ...p,
              x: p.x + p.speedX * 0.5,
              y: p.y + p.speedY * 0.5,
              speedY: p.speedY + 0.1, // gravity
              life: p.life - 2,
              size: p.size * 0.98,
            }))
            .filter(p => p.life > 0)
        );
      }, 30);

      // Clean up after animation completes
      const timeout = setTimeout(() => {
        clearInterval(interval);
        setParticles([]);
        setShowText(false);
        onComplete?.();
      }, 4000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [isActive, playSounds, generateParticles, onComplete]);

  if (!isActive && particles.length === 0) return null;

  return (
    <div className="burn-celebration-overlay">
      {/* Fire particles */}
      <div className="particles-container">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="fire-particle"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              backgroundColor: particle.color,
              opacity: particle.life / 100,
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
            }}
          />
        ))}
      </div>

      {/* Celebration text */}
      {showText && (
        <div className="celebration-text">
          <div className="celebration-icon">🔥</div>
          <div className="celebration-title">TELEBURN COMPLETE</div>
          <div className="celebration-subtitle">Your NFT has been forged into Bitcoin</div>
        </div>
      )}

      <style jsx>{`
        .burn-celebration-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 9999;
          overflow: hidden;
        }

        .particles-container {
          position: absolute;
          width: 100%;
          height: 100%;
        }

        .fire-particle {
          position: absolute;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          transition: none;
        }

        .celebration-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          animation: celebrationFadeIn 0.5s ease-out forwards;
        }

        .celebration-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
          animation: iconPulse 0.5s ease-out;
        }

        .celebration-title {
          font-size: 2.5rem;
          font-weight: bold;
          color: #ff6600;
          text-shadow: 0 0 20px #ff6600, 0 0 40px #ff4400;
          margin-bottom: 0.5rem;
          letter-spacing: 0.1em;
        }

        .celebration-subtitle {
          font-size: 1.2rem;
          color: #ffaa00;
          opacity: 0.9;
        }

        @keyframes celebrationFadeIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes iconPulse {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.3);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

