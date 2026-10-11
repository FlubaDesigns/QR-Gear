import type { ReactNode } from 'react';

/** Builder content composes the canonical PageSkeleton rows and Master helpers. */
export function MemberWizardFrame({ header, status, children, navigation, testId = 'member-wizard-frame' }: {
  testId?: string;
  header: ReactNode;
  status?: ReactNode;
  children: ReactNode;
  navigation?: ReactNode;
}) {
  return (
    <div className="row" data-testid={testId}>
      <div className="row">
        <div className="flex-between wrap flex-row-reverse py-3">{header}</div>
      </div>
      <div className={status ? 'layout__split-1-3' : 'row'}>
        {status && <aside className="row" aria-label="Build progress">{status}</aside>}
        <div className="row">
          <div className="row" id="wizard-step-content">{children}</div>
          {navigation && (
            <div className="row sticky bottom-0 z-10 mt-4">
              <div className="flex-between wrap gap-3 py-3 border-t border-slate-700 bg-slate-800/95 backdrop-blur-sm">
                {navigation}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
