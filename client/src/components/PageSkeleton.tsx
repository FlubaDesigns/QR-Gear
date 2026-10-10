import type { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import master from '@/styles/canonical/master.css?raw';
import fonts from '@/styles/canonical/fonts.css?raw';
import buttons from '@/styles/canonical/buttons.css?raw';
import forms from '@/styles/canonical/forms.css?raw';
import theme from '@/styles/canonical/qrgear-theme.css?raw';
import site from '@/styles/canonical/qrgear-site.css?raw';

// Keep the upstream masters byte-for-byte. Their document-level tokens belong
// to this React page root; scope prevents changes to other routes or the shell.
const styles = `@scope (.qrg-skeleton) to ([data-component]) {\n${
  [master, fonts, buttons, forms, theme, site].join('\n').replaceAll(':root', ':scope')
}\n}`;

/** React expression of canonical-v1/skeleton.html's stage/main/slot contract. */
export function PageSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="qrg-skeleton">
      <style>{styles}</style>
      <div className="stage">
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <div data-component="site-header"><Navbar /></div>
        <main id="main-content" className="main">
          <div className="main-inner" data-slot="page-content">{children}</div>
        </main>
        <div data-component="site-footer"><Footer /></div>
      </div>
    </div>
  );
}
