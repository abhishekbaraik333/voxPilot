'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Phone,
  History,
  FileText,
  Settings,
  LogOut,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/calls', label: 'Make a Call', icon: Phone },
  { href: '/history', label: 'Call History', icon: History },
  { href: '/prompts', label: 'Prompt Templates', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuthStore();

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
      style={{ width: 'var(--sidebar-width)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-[var(--color-border)]">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-purple-600 flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-[var(--color-text-primary)]">VoxPilot</h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">AI Voice Agent</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all',
                isActive
                  ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent-hover)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
              )}
            >
              <Icon className="w-[18px] h-[18px]" />
              {item.label}
              {item.href === '/calls' && (
                <span className="ml-auto w-2 h-2 rounded-full bg-[var(--color-success)] animate-[pulse-dot_1.5s_ease-in-out_infinite]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center text-[12px] font-semibold text-[var(--color-text-secondary)] shrink-0">
              {user?.name?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">
                {user?.name || 'Admin'}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                {user?.email || ''}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
