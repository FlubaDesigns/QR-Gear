import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SEO from "@/components/SEO";
import { MemberOnboarding } from "@/features/members/MemberOnboarding";

export default function MemberOnboardingPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const userId = user?.id || '';
  const onboardingKey = `member_onboarding_complete_${userId}`;
  const isComplete = userId ? localStorage.getItem(onboardingKey) === 'true' : false;

  useEffect(() => {
    if (!authLoading && userId && isComplete) {
      const params = window.location.search;
      setLocation(`/members${params}`);
    }
  }, [authLoading, userId, isComplete, setLocation]);

  if (authLoading || (userId && isComplete)) {
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
