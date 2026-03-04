import { initializeApp, getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";

const FLUBA_APP_NAME = "fluba-brain";

const SITE_ID = import.meta.env.VITE_SITE_ID || "qr-gear";

const flubaConfig = {
  apiKey: import.meta.env.VITE_FLUBA_API_KEY,
  authDomain: import.meta.env.VITE_FLUBA_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FLUBA_PROJECT_ID,
  appId: import.meta.env.VITE_FLUBA_APP_ID,
};

export type BrainSubmitInput = {
  prompt: string;
  action?: string;
  payload?: Record<string, any>;
  idempotencyKey?: string;
  traceId?: string;
};

export type BrainSubmitResult = {
  requestId: string;
  traceId?: string;
  status: string;
  deduped?: boolean;
};

function getFlubaApp() {
  try {
    return getApp(FLUBA_APP_NAME);
  } catch {
    if (!flubaConfig.apiKey || !flubaConfig.projectId) {
      console.warn("[Brain] Fluba config missing — VITE_FLUBA_API_KEY and VITE_FLUBA_PROJECT_ID required");
      return null;
    }
    return initializeApp(flubaConfig, FLUBA_APP_NAME);
  }
}

let _client: ReturnType<typeof _makeClient> | null = null;

function _makeClient() {
  const app = getFlubaApp();
  if (!app) return null;

  const functions = getFunctions(app, "us-central1");
  const db = getFirestore(app);

  async function submitToBrain(input: BrainSubmitInput): Promise<BrainSubmitResult> {
    const call = httpsCallable(functions, "brainSubmit");
    const data: Record<string, any> = {
      siteId: SITE_ID,
      prompt: input.prompt,
      payload: input.payload || {},
      idempotencyKey: input.idempotencyKey || null,
      traceId: input.traceId || null,
    };
    if (input.action) data.action = input.action;
    const res: any = await call(data);
    return res.data as BrainSubmitResult;
  }

  function listenToBrainResponse(requestId: string, cb: (data: any) => void): Unsubscribe {
    const ref = doc(db, "brain_responses", requestId);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      cb(snap.data());
    });
  }

  function isConfigured(): boolean {
    return true;
  }

  return { submitToBrain, listenToBrainResponse, isConfigured };
}

export function getFlubaBrainClient() {
  if (!_client) {
    _client = _makeClient();
  }
  return _client;
}

export function isBrainConfigured(): boolean {
  return !!(flubaConfig.apiKey && flubaConfig.projectId);
}
