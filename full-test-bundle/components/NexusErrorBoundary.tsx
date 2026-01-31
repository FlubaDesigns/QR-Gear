/* ==========================================
   NEXUS ERROR BOUNDARY
   File: client/src/components/NexusErrorBoundary.tsx
   ========================================== */

import React from "react";
import { Nexus } from "@/lib/nexus";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
};

export class NexusErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: any): State {
    return { hasError: true, message: err?.message || "Something went wrong." };
  }

  componentDidCatch(error: any, info: any) {
    Nexus.captureError(error, "ReactErrorBoundary", { info });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div style={{ padding: 18 }}>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>We hit a snag.</h2>
            <p style={{ opacity: 0.8, marginBottom: 12 }}>
              The app encountered an error and logged it for recovery.
            </p>

            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(0,0,0,0.35)",
                cursor: "pointer",
              }}
            >
              Reload
            </button>

            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7, wordBreak: "break-word" }}>
              {this.state.message}
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
