import React from "react";

export class InlineDebugBoundary extends React.Component<
  { label?: string; children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("DEBUG BOUNDARY CAUGHT:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, border: "2px solid red", background: "#200", wordBreak: "break-word" }}>
          <h3 style={{ color: "#f88" }}>
            Crash inside: {this.props.label || "Unknown"}
          </h3>
          <pre style={{ color: "#fff", fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word" }}>
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
