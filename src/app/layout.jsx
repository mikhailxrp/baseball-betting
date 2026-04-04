import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  title: 'MLB Analytics',
  description: 'Baseball betting analytics platform',
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full"
        style={{ backgroundColor: '#0F1624', fontFamily: 'Inter, sans-serif' }}
      >
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <Nav />
          <main
            style={{
              flex: 1,
              marginLeft: '48px',
              overflowY: 'auto',
              minHeight: '100vh',
              backgroundColor: '#0F1624',
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

