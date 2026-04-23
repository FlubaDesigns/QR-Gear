import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { MemberOnboarding } from "@/features/members/MemberOnboarding";
import { useMemberRuntimeState } from "@/features/members/useMemberRuntimeState";

export default function MemberOnboardingPage() {
  const { isLoading, isAuthenticated, userId, onboardingComplete } = useMemberRuntimeState();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && userId && onboardingComplete) {
      const params = window.location.search;
      setLocation(`/members${params}`);
    }
  }, [isLoading, userId, onboardingComplete, setLocation]);

  if (isLoading || (userId && onboardingComplete)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  const handleComplete = (data: any) => {
    if (userId) {
      localStorage.setItem(`member_onboarding_complete_${userId}`, 'true');
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
