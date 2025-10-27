import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'KILN ঌ TELEBURN PROTOCOL',
  description: '[CLASSIFIED] Cryptographically-verified teleburn protocol for permanent NFT migration. Proof of burn. Irreversible. No custody.',
  keywords: ['Solana', 'Bitcoin', 'Ordinals', 'NFT', 'Teleburn', 'KILN', 'Cryptography', 'Cypherpunk'],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body className="font-mono antialiased">
        {children}
      </body>
    </html>
  );
}

