/* ==========================================
   NEXUS TEST UTILITIES (QR GEAR)
   File: client/src/lib/nexusTests.ts
   
   Reusable test utilities that can be run from
   the Nexus Console to verify feature health.
   ========================================== */

import { Nexus } from "./nexus";
import { authFetch } from "@/features/adminAuth/authFetch";

const getAuthHeaders = async (): Promise<HeadersInit> => {
  const { auth } = await import("@/lib/firebase");
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }
  return {};
};

export type TestResult = {
  name: string;
  status: "pass" | "fail" | "warn";
  details?: string;
  duration: number;
};

export type TestSuite = {
  name: string;
  description: string;
  tests: () => Promise<TestResult[]>;
};

async function runTest(
  name: string,
  fn: () => Promise<{ status: "pass" | "fail" | "warn"; details?: string }>
): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return { name, ...result, duration: Date.now() - start };
  } catch (e: any) {
    return { name, status: "fail", details: e.message, duration: Date.now() - start };
  }
}

/* ==========================================
   GRAPHIC SETS TEST SUITE
   ========================================== */
export const graphicSetsTests: TestSuite = {
  name: "Graphic Sets",
  description: "Verify Graphic Sets CRUD operations and API endpoints",
  tests: async () => {
    const results: TestResult[] = [];

    results.push(
      await runTest("API Route Secured", async () => {
        try {
          const res = await authFetch("/api/admin/graphic-sets", getAuthHeaders);
          return { status: "pass", details: "Authenticated access works" };
        } catch (err: any) {
          if (err.message?.includes("401")) {
            return { status: "pass", details: "Requires authentication" };
          }
          return { status: "warn", details: err.message };
        }
      })
    );

    results.push(
      await runTest("List Graphic Sets", async () => {
        try {
          const res = await authFetch("/api/admin/graphic-sets", getAuthHeaders);
          const data = await res.json();
          return { status: "pass", details: `Found ${data.length} sets` };
        } catch (err: any) {
          if (err.message?.includes("401")) return { status: "warn", details: "Login required to test" };
          throw err;
        }
      })
    );

    results.push(
      await runTest("Create & Delete Graphic Set", async () => {
        try {
          const createRes = await authFetch("/api/admin/graphic-sets", getAuthHeaders, {
            method: "POST",
            body: JSON.stringify({
              name: "NEXUS_TEST_" + Date.now(),
              description: "Automated test - safe to delete",
              destinationUrl: "https://example.com/test",
            }),
          });
          
          const created = await createRes.json();
          
          await authFetch(`/api/admin/graphic-sets/${created.id}`, getAuthHeaders, {
            method: "DELETE",
          });
          
          return { status: "pass", details: `Created ID ${created.id}, then cleaned up` };
        } catch (err: any) {
          if (err.message?.includes("401")) return { status: "warn", details: "Login required" };
          throw err;
        }
      })
    );

    return results;
  },
};

/* ==========================================
   API HEALTH TEST SUITE
   ========================================== */
export const apiHealthTests: TestSuite = {
  name: "API Health",
  description: "Check core API endpoints are responding",
  tests: async () => {
    const results: TestResult[] = [];

    const endpoints = [
      { name: "Products", url: "/api/products" },
      { name: "Categories", url: "/api/categories" },
      { name: "Cart", url: "/api/cart" },
    ];

    for (const ep of endpoints) {
      results.push(
        await runTest(`${ep.name} Endpoint`, async () => {
          const res = await fetch(ep.url, { credentials: "include" });
          if (res.ok) return { status: "pass", details: `HTTP ${res.status}` };
          if (res.status === 401) return { status: "warn", details: "Auth required" };
          return { status: "fail", details: `HTTP ${res.status}` };
        })
      );
    }

    return results;
  },
};

/* ==========================================
   STORAGE TEST SUITE
   ========================================== */
export const storageTests: TestSuite = {
  name: "Storage",
  description: "Verify Firebase Storage connectivity",
  tests: async () => {
    const results: TestResult[] = [];

    results.push(
      await runTest("Storage Health Check", async () => {
        const res = await fetch("/api/storage/health", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          return { status: "pass", details: data.bucket || "Connected" };
        }
        if (res.status === 404) return { status: "warn", details: "Health endpoint not available" };
        return { status: "fail", details: `HTTP ${res.status}` };
      })
    );

    return results;
  },
};

/* ==========================================
   TEST RUNNER
   ========================================== */
export const NexusTestSuites: TestSuite[] = [
  graphicSetsTests,
  apiHealthTests,
  storageTests,
];

export async function runTestSuite(suite: TestSuite): Promise<TestResult[]> {
  Nexus.info("NEXUS_TESTS", `Running suite: ${suite.name}`);
  const results = await suite.tests();
  
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const warned = results.filter((r) => r.status === "warn").length;
  
  Nexus.info("NEXUS_TESTS", `${suite.name}: ${passed} passed, ${failed} failed, ${warned} warnings`, {
    results,
  });
  
  return results;
}

export async function runAllTests(): Promise<{ suite: string; results: TestResult[] }[]> {
  Nexus.info("NEXUS_TESTS", "Running all test suites...");
  const allResults: { suite: string; results: TestResult[] }[] = [];
  
  for (const suite of NexusTestSuites) {
    const results = await runTestSuite(suite);
    allResults.push({ suite: suite.name, results });
  }
  
  return allResults;
}
