import type { Metadata } from 'next';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { SocketProvider } from '@/context/SocketContext';
import { QueryProvider } from '@/context/QueryContext';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shop OS',
  description: 'Modern shop management',
  icons: { icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">☕</text></svg>' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin:0, padding:0 }}>
        <QueryProvider>
          <ThemeProvider>
            <AuthProvider>
              <SocketProvider>
                <Toaster position="top-right" toastOptions={{ style: { background: '#111', color: '#fff', fontSize: '13px', borderRadius: '12px' } }} />
                {children}
              </SocketProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}