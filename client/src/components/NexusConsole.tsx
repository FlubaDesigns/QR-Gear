import { useMemo, useState } from "react";
import { Nexus } from "@/lib/nexus";
import { useAuth } from "@/hooks/useAuth";

export default function NexusConsole() {
  const [open, setOpen] = useState(false);
  const { isAdmin } = useAuth();

  const mem = useMemo(() => Nexus.getMemory().slice().reverse(), [open]);

  if (!isAdmin) {
    return null;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        data-testid="button-nexus-console"
        style={{
          position: "fixed",
          bottom: 14,
          right: 14,
          padding: "10px 12px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(0,0,0,0.35)",
          zIndex: 9999,
          cursor: "pointer",
          fontSize: 12,
          color: "#fff",
        }}
      >
        Nexus
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 14,
        right: 14,
        width: 360,
        maxHeight: 520,
        overflow: "auto",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(0,0,0,0.85)",
        zIndex: 9999,
        padding: 12,
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontWeight: 700 }}>Nexus Memory</div>
        <button
          onClick={() => setOpen(false)}
          data-testid="button-nexus-close"
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(0,0,0,0.35)",
            cursor: "pointer",
            color: "#fff",
          }}
        >
          Close
        </button>
      </div>

      {mem.length === 0 ? (
        <div style={{ opacity: 0.75, fontSize: 12 }}>No events yet.</div>
      ) : (
        mem.map((e, i) => (
          <div
            key={i}
            style={{
              marginBottom: 10,
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              <b>{e.type}</b> — {e.source}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{e.message}</div>
            {e.meta ? (
              <pre style={{ marginTop: 8, fontSize: 11, opacity: 0.75, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(e.meta, null, 2)}
              </pre>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
