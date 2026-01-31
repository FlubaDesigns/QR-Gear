import { useMemo, useState } from "react";
import { Nexus } from "@/lib/nexus";
import { useAuth } from "@/hooks/useAuth";
import { NexusTestSuites, runTestSuite, runAllTests, type TestResult } from "@/lib/nexusTests";

type TabType = "memory" | "tests";

export default function NexusConsole() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabType>("memory");
  const [testResults, setTestResults] = useState<{ suite: string; results: TestResult[] }[]>([]);
  const [running, setRunning] = useState(false);
  const { isAdmin } = useAuth();

  const mem = useMemo(() => Nexus.getMemory().slice().reverse(), [open, tab]);

  const handleRunAll = async () => {
    setRunning(true);
    try {
      const results = await runAllTests();
      setTestResults(results);
    } finally {
      setRunning(false);
    }
  };

  const handleRunSuite = async (suiteIndex: number) => {
    setRunning(true);
    try {
      const suite = NexusTestSuites[suiteIndex];
      const results = await runTestSuite(suite);
      setTestResults((prev) => {
        const updated = prev.filter((r) => r.suite !== suite.name);
        return [...updated, { suite: suite.name, results }];
      });
    } finally {
      setRunning(false);
    }
  };

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

  const tabStyle = (active: boolean) => ({
    padding: "6px 12px",
    borderRadius: 8,
    border: "none",
    background: active ? "rgba(255,255,255,0.15)" : "transparent",
    cursor: "pointer",
    color: "#fff",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
  });

  const statusIcon = (status: TestResult["status"]) => {
    if (status === "pass") return "✅";
    if (status === "fail") return "❌";
    return "⚠️";
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 14,
        right: 14,
        width: 400,
        maxHeight: 560,
        overflow: "auto",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(0,0,0,0.9)",
        zIndex: 9999,
        padding: 12,
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontWeight: 700 }}>Nexus Console</div>
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

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setTab("memory")}
          style={tabStyle(tab === "memory")}
          data-testid="button-nexus-tab-memory"
        >
          Memory
        </button>
        <button
          onClick={() => setTab("tests")}
          style={tabStyle(tab === "tests")}
          data-testid="button-nexus-tab-tests"
        >
          Tests
        </button>
      </div>

      {tab === "memory" && (
        <>
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
        </>
      )}

      {tab === "tests" && (
        <>
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={handleRunAll}
              disabled={running}
              data-testid="button-nexus-run-all-tests"
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: running ? "rgba(100,100,100,0.5)" : "rgba(100,200,100,0.3)",
                cursor: running ? "not-allowed" : "pointer",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                width: "100%",
              }}
            >
              {running ? "Running..." : "Run All Tests"}
            </button>
          </div>

          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 10 }}>
            Available Test Suites:
          </div>

          {NexusTestSuites.map((suite, idx) => {
            const suiteResults = testResults.find((r) => r.suite === suite.name);
            const passed = suiteResults?.results.filter((r) => r.status === "pass").length || 0;
            const total = suiteResults?.results.length || 0;

            return (
              <div
                key={suite.name}
                style={{
                  marginBottom: 12,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{suite.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>{suite.description}</div>
                  </div>
                  <button
                    onClick={() => handleRunSuite(idx)}
                    disabled={running}
                    data-testid={`button-nexus-run-${suite.name.toLowerCase().replace(/\s+/g, "-")}`}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "none",
                      background: "rgba(100,150,255,0.3)",
                      cursor: running ? "not-allowed" : "pointer",
                      color: "#fff",
                      fontSize: 11,
                    }}
                  >
                    Run
                  </button>
                </div>

                {suiteResults && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
                      Results: {passed}/{total} passed
                    </div>
                    {suiteResults.results.map((r, ri) => (
                      <div
                        key={ri}
                        style={{
                          display: "flex",
                          gap: 8,
                          fontSize: 11,
                          padding: "4px 0",
                          borderTop: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <span>{statusIcon(r.status)}</span>
                        <span style={{ flex: 1 }}>{r.name}</span>
                        {r.details && (
                          <span style={{ opacity: 0.6, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {r.details}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
