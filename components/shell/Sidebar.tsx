'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Settings, type LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ModuleConfig } from '@/lib/shared/types';

type Props = { modules: ModuleConfig[] };

function resolveIcon(name: string): LucideIcon {
  const Icon = (LucideIcons as unknown as Record<string, LucideIcon | undefined>)[name];
  return Icon ?? (LucideIcons.Box as LucideIcon);
}

export function Sidebar({ modules }: Props) {
  const pathname = usePathname();
  const sorted = [...modules].sort((a, b) => a.nav.order - b.nav.order);

  return (
    <aside className="w-56 border-r bg-slate-50 p-4">
      <div className="mb-6 text-lg font-semibold">Dashboard</div>
      <nav className="space-y-1">
        <NavItem href="/" icon={Home} label="Home" active={pathname === '/'} />
        {sorted.map((m) => {
          const Icon = resolveIcon(m.icon);
          const href = `/${m.id}`;
          return (
            <NavItem
              key={m.id}
              href={href}
              icon={Icon}
              label={m.nav.label}
              active={pathname === href || pathname.startsWith(href + '/')}
            />
          );
        })}
        <div className="pt-4">
          <NavItem
            href="/admin"
            icon={Settings}
            label="Admin"
            active={pathname.startsWith('/admin')}
          />
        </div>
      </nav>
    </aside>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded px-3 py-2 text-sm',
        active ? 'bg-slate-200 font-medium' : 'hover:bg-slate-100',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
