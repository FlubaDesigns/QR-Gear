import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SEO from "@/components/SEO";
import { MemberOnboarding } from "@/features/members/MemberOnboarding";
import { auth } from "@/lib/firebase";

export default function MemberOnboardingPage() {
  const { user: apiUser, firebaseUser, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const userId = apiUser?.id || firebaseUser?.uid || '';
  const onboardingKey = `member_onboarding_complete_${userId}`;
  const localComplete = userId ? localStorage.getItem(onboardingKey) === 'true' : false;
  const [checkedServer, setCheckedServer] = useState(false);
  const [serverComplete, setServerComplete] = useState(false);

  useEffect(() => {
    if (!userId || localComplete) { setCheckedServer(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) { setCheckedServer(true); return; }
        const res = await fetch('/api/members/profile', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { setCheckedServer(true); return; }
        const data = await res.json();
        if (!cancelled && data.isMember) {
          localStorage.setItem(onboardingKey, 'true');
          setServerComplete(true);
        }
      } catch { /* ignore */ }
      if (!cancelled) setCheckedServer(true);
    })();
    return () => { cancelled = true; };
  }, [userId, localComplete, onboardingKey]);

  const isComplete = localComplete || serverComplete;

  useEffect(() => {
    if (!authLoading && userId && isComplete) {
      const params = window.location.search;
      setLocation(`/members${params}`);
    }
  }, [authLoading, userId, isComplete, setLocation]);

  if (authLoading || !checkedServer || (userId && isComplete)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  const handleComplete = (data: any) => {
    if (userId) {
      localStorage.setItem(onboardingKey, 'true');
      localStorage.setItem(`member_onboarding_data_${userId}`, JSON.stringify({
        ...data,
        onboarding_completed_at: new Date().toISOString(),
        onboarding_version: 'v1',
      }));
    }
    const params = window.location.search;
    setLocation(`/members${params}`);
  };

  return (
    <>
      <SEO title="Welcome | QR Gear" description="Set up your creator workspace" />
      <div className="min-h-screen py-8" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
        <MemberOnboarding onComplete={handleComplete} userId={userId} />
      </div>
    </>
  );
}
