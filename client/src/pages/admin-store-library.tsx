import { useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';

/** Keep saved links working while retiring the duplicate Store Products screen. */
export default function AdminStoreLibraryPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(search);
    params.set('tab', 'placement');
    navigate(`/admin/store-builder?${params}`, { replace: true });
  }, [search, navigate]);
  return <p role="status">Opening Placement…</p>;
}
