import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';
import { resetIdentityCache } from '@/lib/identityCache';

/** A different account gets fresh component state as well as a fresh cache. */
export function AuthIdentityBoundary({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [identity, setIdentity] = useState<{ uid: string | null | undefined; epoch: number }>({ uid: undefined, epoch: 0 });
  useEffect(() => onAuthStateChanged(auth, user => {
    resetIdentityCache(client, user?.uid ?? null);
    const uid = user?.uid ?? null;
    setIdentity(previous => ({ uid, epoch: previous.epoch + (previous.uid != null && previous.uid !== uid ? 1 : 0) }));
  }), [client]);
  // Keep an anonymous shopper's unfinished work when they sign in; leaving a
  // real identity always discards that account's component state.
  return identity.uid === undefined ? null : <Fragment key={identity.epoch}>{children}</Fragment>;
}
