import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Share2, Save, Loader2, Plus, Trash2, Play, Pause,
  Calendar, Clock, CheckCircle2, ExternalLink, Copy, X,
  Send, Image as ImageIcon
} from "lucide-react";
import { SiInstagram, SiTiktok, SiX, SiFacebook, SiYoutube, SiLinkedin } from "react-icons/si";
import { getAuthHeaders } from "@/features/shared/components/wizardSteps";
import { useToast } from "@/hooks/use-toast";

interface SocialHandles {
  instagram?: string;
  tiktok?: string;
  x?: string;
  facebook?: string;
  youtube?: string;
  linkedin?: string;
}

interface SchedulePacket {
  id: string;
  title: string;
  itemImage: string | null;
  retailPrice: number | null;
  shareUrl: string;
  referralUrl: string | null;
  shareCaption: string | null;
  shareImageSquareUrl: string | null;
  shareImageLinkUrl: string | null;
  qrType: string | null;
}

interface ScheduleEntry {
  id: string;
  memberId: string;
  packetId: string;
  cadence: string;
  platforms: string[];
  lastPostedAt: string | null;
  nextPostAt: string;
  isActive: boolean;
  createdAt: string;
  packet: SchedulePacket | null;
}

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: SiInstagram, color: 'text-pink-500', placeholder: '@yourhandle' },
  { key: 'tiktok', label: 'TikTok', icon: SiTiktok, color: 'text-white', placeholder: '@yourhandle' },
  { key: 'x', label: 'X (Twitter)', icon: SiX, color: 'text-white', placeholder: '@yourhandle' },
  { key: 'facebook', label: 'Facebook', icon: SiFacebook, color: 'text-blue-500', placeholder: 'facebook.com/yourpage' },
  { key: 'youtube', label: 'YouTube', icon: SiYoutube, color: 'text-red-500', placeholder: '@yourchannel' },
  { key: 'linkedin', label: 'LinkedIn', icon: SiLinkedin, color: 'text-blue-400', placeholder: 'linkedin.com/in/you' },
];

const CADENCE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'every-3-days', label: 'Every 3 Days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Every 2 Weeks' },
  { value: 'monthly', label: 'Monthly' },
];

function formatNextPost(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff <= 0) return 'Now';
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Less than 1 hour';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function getCadenceLabel(cadence: string): string {
  return CADENCE_OPTIONS.find(c => c.value === cadence)?.label || cadence;
}

export function SocialHubView({ memberId }: { memberId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddSchedule, setShowAddSchedule] = useState(false);

  return (
    <div className="space-y-6">
      <SocialProfilesSection memberId={memberId} />
      <ReadyToPostSection memberId={memberId} />
      <ContentCalendarSection
        memberId={memberId}
        showAddSchedule={showAddSchedule}
        setShowAddSchedule={setShowAddSchedule}
      />
    </div>
  );
}

function SocialProfilesSection({ memberId }: { memberId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [handles, setHandles] = useState<SocialHandles>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: profileData, isLoading } = useQuery<{ isMember: boolean; profile?: any }>({
    queryKey: ['/api/members/profile'],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/members/profile', { headers });
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
    enabled: !!memberId,
  });

  useEffect(() => {
    if (profileData?.profile) {
      const p = profileData.profile;
      if (p.socialHandles) {
        setHandles(p.socialHandles);
      } else if (p.socialHandle && p.primarySocial) {
        const migrated: SocialHandles = {};
        const key = p.primarySocial.toLowerCase().replace('twitter', 'x') as keyof SocialHandles;
        if (PLATFORMS.some(pl => pl.key === key)) {
          migrated[key] = p.socialHandle;
        }
        setHandles(migrated);
      }
    }
  }, [profileData]);

  const saveMutation = useMutation({
    mutationFn: async (socialHandles: SocialHandles) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/social-handles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ socialHandles }),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Social profiles saved' });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['/api/members/profile'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    },
  });

  const updateHandle = (key: string, value: string) => {
    setHandles(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const connectedCount = Object.values(handles).filter(v => v && v.trim()).length;

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-white flex items-center gap-2">
          <Share2 className="w-5 h-5" />
          Social Profiles
        </CardTitle>
        <Badge variant="secondary" className="text-xs">
          {connectedCount} connected
        </Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-400 mb-4">
              Add your social media handles so we know where to send your content.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PLATFORMS.map((platform) => {
                const Icon = platform.icon;
                return (
                  <div key={platform.key} className="flex items-center gap-2">
                    <div className={`w-8 h-8 flex items-center justify-center rounded-md bg-slate-700/50 ${platform.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <Input
                      value={handles[platform.key as keyof SocialHandles] || ''}
                      onChange={(e) => updateHandle(platform.key, e.target.value)}
                      placeholder={platform.placeholder}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                      data-testid={`input-social-${platform.key}`}
                    />
                  </div>
                );
              })}
            </div>
            {hasChanges && (
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => saveMutation.mutate(handles)}
                  disabled={saveMutation.isPending}
                  data-testid="button-save-social-handles"
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Save Profiles
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReadyToPostSection({ memberId }: { memberId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: scheduleData } = useQuery<{ success: boolean; schedules: ScheduleEntry[] }>({
    queryKey: ['/api/members', memberId, 'social-schedule'],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/social-schedule`, { headers });
      if (!res.ok) throw new Error('Failed to fetch schedule');
      return res.json();
    },
    enabled: !!memberId,
  });

  const readyItems = useMemo(() => {
    if (!scheduleData?.schedules) return [];
    const now = new Date();
    return scheduleData.schedules
      .filter(s => s.isActive && new Date(s.nextPostAt) <= now && s.packet)
      .sort((a, b) => new Date(a.nextPostAt).getTime() - new Date(b.nextPostAt).getTime());
  }, [scheduleData]);

  const upcomingItem = useMemo(() => {
    if (!scheduleData?.schedules) return null;
    const now = new Date();
    const future = scheduleData.schedules
      .filter(s => s.isActive && new Date(s.nextPostAt) > now)
      .sort((a, b) => new Date(a.nextPostAt).getTime() - new Date(b.nextPostAt).getTime());
    return future[0] || null;
  }, [scheduleData]);

  const markPostedMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/social-schedule/${scheduleId}/mark-posted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
      });
      if (!res.ok) throw new Error('Failed to mark posted');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Marked as posted' });
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'social-schedule'] });
    },
  });

  const emailReminderMutation = useMutation({
    mutationFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/social-schedule/send-reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
      });
      if (!res.ok) throw new Error('Failed to send reminder');
      return res.json();
    },
    onSuccess: (data) => {
      if (data.sent) {
        toast({ title: 'Reminder sent!', description: `Email with ${data.itemCount} item${data.itemCount === 1 ? '' : 's'} sent to your inbox.` });
      } else {
        toast({ title: 'Nothing to send', description: data.message || 'No items are due right now.' });
      }
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    },
  });

  const handleShare = async (item: ScheduleEntry, platform?: string) => {
    if (!item.packet) return;
    const shareUrl = item.packet.referralUrl || item.packet.shareUrl || `${window.location.origin}/p/${item.packetId}`;
    const caption = item.packet.shareCaption || `Check out ${item.packet.title}! ${shareUrl}`;

    if (!platform && navigator.share) {
      try {
        await navigator.share({ title: item.packet.title, text: caption, url: shareUrl });
        return;
      } catch { }
    }

    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(caption);
    let intentUrl = '';

    switch (platform) {
      case 'x':
        intentUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
        break;
      case 'facebook':
        intentUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'linkedin':
        intentUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case 'instagram':
        try {
          await navigator.clipboard.writeText(caption);
          toast({ title: 'Caption copied! Open Instagram to paste.' });
        } catch { }
        return;
      case 'tiktok':
        try {
          await navigator.clipboard.writeText(caption);
          toast({ title: 'Caption copied! Open TikTok to paste.' });
        } catch { }
        return;
      default:
        try {
          await navigator.clipboard.writeText(caption);
          toast({ title: 'Copied to clipboard' });
        } catch { }
        return;
    }

    if (intentUrl) window.open(intentUrl, '_blank', 'noopener,noreferrer');
  };

  if (readyItems.length === 0) {
    return (
      <Card className="bg-gradient-to-r from-emerald-900/30 to-teal-900/20 border-emerald-500/30">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-white font-medium">All caught up!</p>
            <p className="text-sm text-slate-400">
              {upcomingItem
                ? `Next post due in ${formatNextPost(upcomingItem.nextPostAt)} — ${upcomingItem.packet?.title || 'Scheduled item'}`
                : 'Add products to your content calendar to get started.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-amber-500/30">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-white flex items-center gap-2">
          <Send className="w-5 h-5 text-amber-400" />
          Ready to Post
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => emailReminderMutation.mutate()}
            disabled={emailReminderMutation.isPending}
            className="border-slate-600 text-white"
            data-testid="button-email-reminder"
          >
            {emailReminderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            Email Me
          </Button>
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
            {readyItems.length} {readyItems.length === 1 ? 'item' : 'items'} due
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {readyItems.map((item) => (
          <div key={item.id} className="p-4 bg-slate-700/50 rounded-lg space-y-3" data-testid={`ready-item-${item.id}`}>
            <div className="flex items-start gap-3">
              {item.packet?.itemImage && (
                <img
                  src={item.packet.itemImage}
                  alt={item.packet.title}
                  className="w-16 h-16 object-cover rounded-md shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{item.packet?.title || 'Untitled'}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="secondary" className="text-xs">{getCadenceLabel(item.cadence)}</Badge>
                  {item.packet?.retailPrice && (
                    <Badge variant="secondary" className="text-xs">${item.packet.retailPrice.toFixed(2)}</Badge>
                  )}
                </div>
              </div>
            </div>

            {item.packet?.shareCaption && (
              <div className="p-2 bg-slate-800/50 rounded text-sm text-slate-300 max-h-20 overflow-hidden">
                {item.packet.shareCaption}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {item.platforms.map((platform) => {
                const pl = PLATFORMS.find(p => p.key === platform);
                if (!pl) return null;
                const Icon = pl.icon;
                return (
                  <Button
                    key={platform}
                    size="sm"
                    variant="outline"
                    onClick={() => handleShare(item, platform)}
                    className="border-slate-600 text-white"
                    data-testid={`button-share-${platform}-${item.id}`}
                  >
                    <Icon className={`w-4 h-4 mr-1 ${pl.color}`} />
                    Post to {pl.label}
                  </Button>
                );
              })}
              {typeof navigator !== 'undefined' && navigator.share && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleShare(item)}
                  className="border-slate-600 text-white"
                  data-testid={`button-share-native-${item.id}`}
                >
                  <Share2 className="w-4 h-4 mr-1" />
                  Share
                </Button>
              )}
            </div>

            {item.packet?.shareImageSquareUrl && (
              <div className="flex gap-2">
                <a
                  href={item.packet.shareImageSquareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 flex items-center gap-1"
                  data-testid={`link-download-square-${item.id}`}
                >
                  <ImageIcon className="w-3 h-3" /> Square Image
                </a>
                {item.packet?.shareImageLinkUrl && (
                  <a
                    href={item.packet.shareImageLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 flex items-center gap-1"
                    data-testid={`link-download-link-${item.id}`}
                  >
                    <ImageIcon className="w-3 h-3" /> Link Preview
                  </a>
                )}
              </div>
            )}

            <Button
              size="sm"
              onClick={() => markPostedMutation.mutate(item.id)}
              disabled={markPostedMutation.isPending}
              className="bg-emerald-600"
              data-testid={`button-mark-posted-${item.id}`}
            >
              {markPostedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Mark as Posted
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ContentCalendarSection({ memberId, showAddSchedule, setShowAddSchedule }: {
  memberId: string;
  showAddSchedule: boolean;
  setShowAddSchedule: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: scheduleData, isLoading } = useQuery<{ success: boolean; schedules: ScheduleEntry[] }>({
    queryKey: ['/api/members', memberId, 'social-schedule'],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/social-schedule`, { headers });
      if (!res.ok) throw new Error('Failed to fetch schedule');
      return res.json();
    },
    enabled: !!memberId,
  });

  const schedules = scheduleData?.schedules || [];

  const toggleMutation = useMutation({
    mutationFn: async ({ scheduleId, isActive }: { scheduleId: string; isActive: boolean }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/social-schedule/${scheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'social-schedule'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/social-schedule/${scheduleId}`, {
        method: 'DELETE',
        headers: { ...headers },
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Schedule removed' });
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'social-schedule'] });
    },
  });

  const updateCadenceMutation = useMutation({
    mutationFn: async ({ scheduleId, cadence }: { scheduleId: string; cadence: string }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/social-schedule/${scheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ cadence }),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Cadence updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'social-schedule'] });
    },
  });

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-white flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Content Calendar
        </CardTitle>
        <Button
          size="sm"
          onClick={() => setShowAddSchedule(!showAddSchedule)}
          data-testid="button-add-schedule"
        >
          {showAddSchedule ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showAddSchedule ? 'Cancel' : 'Add Product'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAddSchedule && (
          <AddScheduleForm
            memberId={memberId}
            onComplete={() => setShowAddSchedule(false)}
          />
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="mb-1">No scheduled products yet</p>
            <p className="text-sm">Add a published product to start your content calendar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className={`p-3 rounded-lg border ${schedule.isActive ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-800/30 border-slate-700/50 opacity-60'}`}
                data-testid={`schedule-item-${schedule.id}`}
              >
                <div className="flex items-start gap-3">
                  {schedule.packet?.itemImage && (
                    <img
                      src={schedule.packet.itemImage}
                      alt={schedule.packet.title}
                      className="w-12 h-12 object-cover rounded-md shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {schedule.packet?.title || schedule.packetId}
                    </p>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <Badge variant="secondary" className="text-xs">{getCadenceLabel(schedule.cadence)}</Badge>
                      <span className="text-xs text-slate-400 flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(schedule.nextPostAt) <= new Date() ? 'Due now' : `Next: ${formatNextPost(schedule.nextPostAt)}`}
                      </span>
                    </div>
                    {schedule.platforms.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {schedule.platforms.map((p) => {
                          const pl = PLATFORMS.find(plat => plat.key === p);
                          if (!pl) return null;
                          const Icon = pl.icon;
                          return <Icon key={p} className={`w-3 h-3 ${pl.color}`} />;
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Select
                      value={schedule.cadence}
                      onValueChange={(val) => updateCadenceMutation.mutate({ scheduleId: schedule.id, cadence: val })}
                    >
                      <SelectTrigger className="w-[110px] h-8 text-xs bg-slate-700/50 border-slate-600 text-white" data-testid={`select-cadence-${schedule.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CADENCE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleMutation.mutate({ scheduleId: schedule.id, isActive: !schedule.isActive })}
                      data-testid={`button-toggle-${schedule.id}`}
                    >
                      {schedule.isActive ? <Pause className="w-4 h-4 text-yellow-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(schedule.id)}
                      data-testid={`button-delete-${schedule.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddScheduleForm({ memberId, onComplete }: { memberId: string; onComplete: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPacketId, setSelectedPacketId] = useState('');
  const [cadence, setCadence] = useState('weekly');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const { data: profileData } = useQuery<{ isMember: boolean; profile?: any }>({
    queryKey: ['/api/members/profile'],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/members/profile', { headers });
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
  });

  const { data: packetsData, isLoading: packetsLoading } = useQuery<{ items: any[] }>({
    queryKey: ['/api/members', memberId, 'published-items'],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/published-items`, { headers });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    enabled: !!memberId,
  });

  const connectedPlatforms = useMemo(() => {
    const handles = profileData?.profile?.socialHandles || {};
    return PLATFORMS.filter(p => handles[p.key] && handles[p.key].trim());
  }, [profileData]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPacketId) throw new Error('Select a product');
      if (selectedPlatforms.length === 0) throw new Error('Select at least one platform');
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/members/${memberId}/social-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ packetId: selectedPacketId, cadence, platforms: selectedPlatforms }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create schedule');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Product added to calendar' });
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'social-schedule'] });
      onComplete();
    },
    onError: (err: Error) => {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    },
  });

  const togglePlatform = (key: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const packets = packetsData?.items || [];

  return (
    <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600 space-y-4" data-testid="add-schedule-form">
      <div>
        <label className="text-sm text-slate-300 mb-1 block">Select Product</label>
        {packetsLoading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading products...
          </div>
        ) : packets.length === 0 ? (
          <p className="text-sm text-slate-400">No published products yet. Create and publish a product first.</p>
        ) : (
          <Select value={selectedPacketId} onValueChange={setSelectedPacketId}>
            <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white" data-testid="select-packet">
              <SelectValue placeholder="Choose a product..." />
            </SelectTrigger>
            <SelectContent>
              {packets.map((pkt: any) => (
                <SelectItem key={pkt.id} value={pkt.id}>
                  {pkt.title || pkt.simpleTitle || pkt.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div>
        <label className="text-sm text-slate-300 mb-1 block">How Often</label>
        <Select value={cadence} onValueChange={setCadence}>
          <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white" data-testid="select-cadence">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CADENCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm text-slate-300 mb-1 block">Post To</label>
        {connectedPlatforms.length === 0 ? (
          <p className="text-sm text-slate-400">Save your social handles above first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {connectedPlatforms.map((platform) => {
              const Icon = platform.icon;
              const isSelected = selectedPlatforms.includes(platform.key);
              return (
                <Button
                  key={platform.key}
                  size="sm"
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => togglePlatform(platform.key)}
                  className={isSelected ? '' : 'border-slate-600 text-white'}
                  data-testid={`toggle-platform-${platform.key}`}
                >
                  <Icon className={`w-4 h-4 mr-1 ${isSelected ? '' : platform.color}`} />
                  {platform.label}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onComplete} className="text-white" data-testid="button-cancel-schedule">
          Cancel
        </Button>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !selectedPacketId || selectedPlatforms.length === 0}
          data-testid="button-create-schedule"
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          Add to Calendar
        </Button>
      </div>
    </div>
  );
}
