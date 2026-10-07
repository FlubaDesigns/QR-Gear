import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  auth: {}, local: { type: 'LOCAL' },
  setPersistence: vi.fn(), email: vi.fn(), signup: vi.fn(),
  google: vi.fn(), custom: vi.fn(), signOut: vi.fn(),
}));
vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/firestore', () => ({ getFirestore: vi.fn() }));
vi.mock('firebase/storage', () => ({ getStorage: vi.fn() }));
vi.mock('firebase/auth', () => ({
  getAuth: () => sdk.auth, browserLocalPersistence: sdk.local,
  setPersistence: sdk.setPersistence, signInWithEmailAndPassword: sdk.email,
  createUserWithEmailAndPassword: sdk.signup, signInWithPopup: sdk.google,
  signInWithCustomToken: sdk.custom, signOut: sdk.signOut,
  GoogleAuthProvider: class {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'fixture');
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'fixture');
  vi.stubEnv('VITE_FIREBASE_APP_ID', 'fixture');
  sdk.setPersistence.mockResolvedValue(undefined);
});

describe('persistent browser sign-in', () => {
  it.each([
    ['signInWithEmail', 'email', ['owner@example.test', 'fixture']],
    ['signUpWithEmail', 'signup', ['owner@example.test', 'fixture']],
    ['signInWithGoogle', 'google', []],
    ['signInWithAuthorizationEngine', 'custom', ['fixture-custom-token']],
  ] as const)('%s waits for local persistence before signing in', async (name, sdkName, args) => {
    let release!: () => void;
    sdk.setPersistence.mockReturnValueOnce(new Promise<void>(resolve => { release = resolve; }));
    const firebase = await import('./firebase');
    const signIn = firebase[name] as (...values: string[]) => Promise<unknown>;
    const pending = signIn(...args);
    expect(sdk.setPersistence).toHaveBeenCalledWith(sdk.auth, sdk.local);
    expect(sdk[sdkName]).not.toHaveBeenCalled();
    release();
    await pending;
    expect(sdk[sdkName]).toHaveBeenCalledTimes(1);
    expect(sdk[sdkName].mock.calls[0][0]).toBe(sdk.auth);
  });

  it('does not consume the engine token when persistent storage fails', async () => {
    sdk.setPersistence.mockRejectedValueOnce(new Error('storage unavailable'));
    const { signInWithAuthorizationEngine } = await import('./firebase');
    await expect(signInWithAuthorizationEngine('fixture-custom-token')).rejects.toThrow('storage unavailable');
    expect(sdk.custom).not.toHaveBeenCalled();
  });

  it('explicit sign-out still uses Firebase to clear the persisted session', async () => {
    const { signOut } = await import('./firebase');
    await signOut();
    expect(sdk.signOut).toHaveBeenCalledWith(sdk.auth);
  });
});
