import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Share2, Save, Loader2, Copy, Send, Image as ImageIcon, ExternalLink, CheckCircle2
} from 'lucide-react';
import { SiInstagram, SiTiktok, SiX, SiFacebook, SiYoutube, SiLinkedin } from 'react-icons/si';
import { memberFetch } from "@/lib/memberFetch";
import { useToast } from '@/hooks/use-toast';

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
  packet: {
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
  } | null;
}

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

interface SocialHandles {
  instagram?: string;
  tiktok?: string;
  x?: string;
  facebook?: string;
  youtube?: string;
  linkedin?: string;
}

interface ContactInfo {
  contactEmail: string;
  phoneNumber: string;
}

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: SiInstagram, color: 'text-pink-500', placeholder: '@yourhandle' },
  { key: 'tiktok', label: 'TikTok', icon: SiTiktok, color: 'text-white', placeholder: '@yourhandle' },
  { key: 'x', label: 'X (Twitter)', icon: SiX, color: 'text-white', placeholder: '@yourhandle' },
  { key: 'facebook', label: 'Facebook', icon: SiFacebook, color: 'text-blue-500', placeholder: 'facebook.com/yourpage' },
  { key: 'youtube', label: 'YouTube', icon: SiYoutube, color: 'text-red-500', placeholder: '@yourchannel' },
  { key: 'linkedin', label: 'LinkedIn', icon: SiLinkedin, color: 'text-blue-400', placeholder: 'linkedin.com/in/you' },
];

export function SocialProfilesSection({ memberId }: { memberId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [handles, setHandles] = useState<SocialHandles>({});
  const [contactInfo, setContactInfo] = useState<ContactInfo>({ contactEmail: '', phoneNumber: '' });
  const [hasChanges, setHasChanges] = useState(false);

  const { data: profileData, isLoading } = useQuery<{ isMember: boolean; profile?: any }>({
    queryKey: ['/api/members/profile'],
    queryFn: () => memberFetch<any>('/profile'),
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
      setContactInfo({
        contactEmail: p.contactEmail || '',
        phoneNumber: p.phoneNumber || '',
      });
    }
  }, [profileData]);

  const saveMutation = useMutation({
    mutationFn: async ({ socialHandles, contact }: { socialHandles: SocialHandles; contact: ContactInfo }) => {
      const [handles, contactResult] = await Promise.all([
        memberFetch(`/${memberId}/social-handles`, { method: 'PUT', json: { socialHandles } }),
        memberFetch(`/${memberId}/contact-info`, { method: 'PUT', json: contact }),
      ]);
      return { handles, contact: contactResult };
    },
    onSuccess: () => {
      toast({ title: 'Profiles saved' });
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

  const updateContact = (key: keyof ContactInfo, value: string) => {
    setContactInfo(prev => ({ ...prev, [key]: value }));
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
              Add your social media handles and contact info for notifications and sharing.
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
            <div className="border-t border-slate-700 pt-4 mt-4">
              <p className="text-sm text-slate-400 mb-3">Contact info for notifications and reminders</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-700/50 text-blue-400">
                    <Send className="w-4 h-4" />
                  </div>
                  <Input
                    type="email"
                    value={contactInfo.contactEmail}
                    onChange={(e) => updateContact('contactEmail', e.target.value)}
                    placeholder="you@example.com"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                    data-testid="input-contact-email"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-700/50 text-green-400">
                    <Copy className="w-4 h-4" />
                  </div>
                  <Input
                    type="tel"
                    value={contactInfo.phoneNumber}
                    onChange={(e) => updateContact('phoneNumber', e.target.value)}
                    placeholder="(555) 123-4567"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                    data-testid="input-phone-number"
                  />
                </div>
              </div>
            </div>
            {hasChanges && (
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => saveMutation.mutate({ socialHandles: handles, contact: contactInfo })}
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


export function ReadyToPostSection({ memberId }: { memberId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: scheduleData } = useQuery<{ success: boolean; schedules: ScheduleEntry[] }>({
    queryKey: ['/api/members', memberId, 'social-schedule'],
    queryFn: () => memberFetch<any>(`/${memberId}/social-schedule`),
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
    mutationFn: (scheduleId: string) =>
      memberFetch(`/${memberId}/social-schedule/${scheduleId}/mark-posted`, { method: 'POST' }),
    onSuccess: () => {
      toast({ title: 'Marked as posted' });
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'social-schedule'] });
    },
  });

  const emailReminderMutation = useMutation({
    mutationFn: () =>
      memberFetch(`/${memberId}/social-schedule/send-reminders`, { method: 'POST' }),
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
              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
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

