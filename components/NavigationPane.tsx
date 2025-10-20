/**
 * NavigationPane Component
 *
 * Sidebar navigation for briefings
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, BookmarkCheck, Archive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NavigationPaneProps {
  savedCount: number;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export function NavigationPane({ savedCount }: NavigationPaneProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      label: 'Today',
      href: '/briefings/latest',
      icon: Calendar,
    },
    {
      label: 'Saved',
      href: '/saved',
      icon: BookmarkCheck,
      badge: savedCount > 0 ? savedCount : undefined,
    },
    {
      label: 'Archives',
      href: '/briefings',
      icon: Archive,
    },
  ];

  return (
    <nav className="flex flex-col gap-2 p-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              isActive && 'bg-accent text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            {item.badge !== undefined && (
              <Badge variant="secondary" role="status">
                {item.badge}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
