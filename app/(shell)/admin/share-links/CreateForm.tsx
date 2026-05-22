'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createLinkAction } from './actions';

type Route = { moduleId: string; route: string; label: string };

export function CreateForm({ routes }: { routes: Route[] }) {
  const initialKey = routes.length > 0 ? `${routes[0]!.moduleId}|${routes[0]!.route}` : '';
  const [selected, setSelected] = useState(initialKey);

  if (routes.length === 0) {
    return <p className="text-sm text-slate-500">No shareable routes available.</p>;
  }

  const [moduleId, route] = selected.split('|');

  return (
    <form action={createLinkAction} className="max-w-md space-y-3">
      <div>
        <Label>Route</Label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-sm"
        >
          {routes.map((r) => (
            <option key={`${r.moduleId}|${r.route}`} value={`${r.moduleId}|${r.route}`}>
              {r.label}
            </option>
          ))}
        </select>
        <input type="hidden" name="moduleId" value={moduleId} />
        <input type="hidden" name="route" value={route ?? ''} />
      </div>
      <div>
        <Label htmlFor="label">Label (optional)</Label>
        <Input id="label" name="label" />
      </div>
      <div>
        <Label htmlFor="expiresInDays">Expires in (days, blank for never)</Label>
        <Input id="expiresInDays" name="expiresInDays" type="number" min={1} />
      </div>
      <Button type="submit">Create link</Button>
    </form>
  );
}
