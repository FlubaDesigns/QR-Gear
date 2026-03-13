import { useState } from "react";
import {
  Sparkles, Loader2, Eye, EyeOff
} from "lucide-react";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/firebase";
import { useQueryClient } from "@tanstack/react-query";

export const PRE_STEP_BLACKBOARDS: Record<string, string[]> = {
  'channel': ['bb-welcome', 'bb-channels'],
  'product': ['bb-pricing'],
  'color': ['bb-zones'],
  'size': ['bb-earnings'],
  'type': ['bb-qr-intro'],
};

export const POST_STEP_BLACKBOARDS: Record<string, string[]> = {
  'channel': ['bb-channel-congrats'],
  'product-congrats': ['bb-product-congrats'],
  'color': ['bb-color-congrats'],
  'size': ['bb-size-congrats'],
};

export const FINAL_CONFIRM_STEPS = ['qr-basic-confirm', 'qr-plus-confirm', 'canvas-confirm', 'play-save-choice', 'compose-confirm'];

export function WizardSignInGate({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (mode === 'sign-up') {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      onSuccess();
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('That email already has an account. Try signing in instead.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError(err.message || 'Something went wrong');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setIsLoading(true);
    try {
      await signInWithGoogle();
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      onSuccess();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Google sign in failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="text-center space-y-4">
      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-emerald-600/20 flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-emerald-400" />
      </div>
      <h2 className="text-lg font-bold text-white">Your creation is ready!</h2>
      <p className="text-slate-400 text-sm">
        {mode === 'sign-up'
          ? 'Create a free account to publish it. Your work is saved right here — just sign up and it goes live.'
          : 'Sign in to publish your creation. Everything you built is right here waiting.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3 text-left">
        {error && <div className="text-red-400 text-sm text-center bg-red-500/10 rounded-md p-2">{error}</div>}

        <div>
          <label className="text-slate-400 text-xs block mb-1">Email</label>
          <input
            type="email"
            autoComplete="email"
            className="w-full rounded-md bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            data-testid="input-wizard-email"
          />
        </div>

        <div>
          <label className="text-slate-400 text-xs block mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              className="w-full rounded-md bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm pr-10 focus:outline-none focus:border-emerald-500"
              placeholder={mode === 'sign-up' ? 'Create a password' : 'Enter your password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              data-testid="input-wizard-password"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          data-testid="button-wizard-auth-submit"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {mode === 'sign-up' ? 'Create Account & Publish' : 'Sign In & Publish'}
        </button>
      </form>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-slate-700" />
        <span className="text-slate-500 text-xs">or</span>
        <div className="flex-1 h-px bg-slate-700" />
      </div>

      <button
        onClick={handleGoogle}
        disabled={isLoading}
        className="w-full rounded-md bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 text-sm disabled:opacity-50"
        data-testid="button-wizard-google-auth"
      >
        Continue with Google
      </button>

      <p className="text-slate-500 text-xs">
        {mode === 'sign-up' ? (
          <>Already have an account?{' '}
            <button className="text-emerald-400 underline" onClick={() => { setMode('sign-in'); setError(''); }} data-testid="button-switch-to-signin">Sign in</button>
          </>
        ) : (
          <>Don't have an account?{' '}
            <button className="text-emerald-400 underline" onClick={() => { setMode('sign-up'); setError(''); }} data-testid="button-switch-to-signup">Create one</button>
          </>
        )}
      </p>

      <button
        onClick={onCancel}
        className="text-slate-500 text-xs underline"
        data-testid="button-wizard-auth-cancel"
      >
        Go back
      </button>
    </div>
  );
}
