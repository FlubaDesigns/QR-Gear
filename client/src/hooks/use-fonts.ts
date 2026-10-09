import { useQuery } from '@tanstack/react-query';
import { FONTS_QUERY_KEY, normalizeFontList } from '@shared/fonts';
export { loadGoogleFont, loadGoogleFonts } from '@/lib/fontLoader';

const EMPTY_FONTS: string[] = [];
export function useFonts() {
  const query = useQuery<{ fonts: string[] }>({
    queryKey: FONTS_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch('/api/fonts');
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error || 'Could not load font settings');
      }
      const data = await response.json();
      return { fonts: normalizeFontList(data.fonts) };
    },
    staleTime: 5 * 60 * 1000,
  });
  return { ...query, fonts: query.data?.fonts ?? EMPTY_FONTS };
}
