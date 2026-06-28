'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useWebSocket } from '@/hooks/useWebSocket';
import Sidebar from '@/components/layout/Sidebar';

/** Main app shell — wraps authenticated pages with sidebar */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loadFromStorage } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Load auth state from localStorage on mount
  useEffect(() => {
    loadFromStorage();
    setMounted(true);
  }, [loadFromStorage]);

  // Connect WebSocket when authenticated
  useWebSocket();

  // Don't render during SSR
  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Login page — no sidebar
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Redirect to login if not authenticated
  useEffect(() => {
    if (mounted && !isAuthenticated && pathname !== '/login') {
      router.push('/login');
    }
  }, [mounted, isAuthenticated, pathname, router]);

  // Show loading spinner if redirecting or mounting
  if (!mounted || (!isAuthenticated && pathname !== '/login')) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className="flex-1 p-6 overflow-y-auto"
        style={{ marginLeft: 'var(--sidebar-width)' }}
      >
        {children}
      </main>
    </div>
  );
}
