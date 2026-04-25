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
import { memberFetch } from "@/lib/memberFetch";
import { useToast } from "@/hooks/use-toast";
import { SocialProfilesSection, ReadyToPostSection } from "./SocialHubSections";

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

function ContentCalendarSection({ memberId, showAddSchedule, setShowAddSchedule }: {
  memberId: string;
  showAddSchedule: boolean;
  setShowAddSchedule: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: scheduleData, isLoading } = useQuery<{ success: boolean; schedules: ScheduleEntry[] }>({
    queryKey: ['/api/members', memberId, 'social-schedule'],
    queryFn: () => memberFetch<any>(`/${memberId}/social-schedule`),
    enabled: !!memberId,
  });

  const schedules = scheduleData?.schedules || [];

  const toggleMutation = useMutation({
    mutationFn: ({ scheduleId, isActive }: { scheduleId: string; isActive: boolean }) =>
      memberFetch(`/${memberId}/social-schedule/${scheduleId}`, { method: 'PUT', json: { isActive } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'social-schedule'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (scheduleId: string) =>
      memberFetch(`/${memberId}/social-schedule/${scheduleId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: 'Schedule removed' });
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'social-schedule'] });
    },
  });

  const updateCadenceMutation = useMutation({
    mutationFn: ({ scheduleId, cadence }: { scheduleId: string; cadence: string }) =>
      memberFetch(`/${memberId}/social-schedule/${scheduleId}`, { method: 'PUT', json: { cadence } }),
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
    queryFn: () => memberFetch<any>('/profile'),
  });

  const { data: packetsData, isLoading: packetsLoading } = useQuery<{ items: any[] }>({
    queryKey: ['/api/members', memberId, 'published-items'],
    queryFn: () => memberFetch<any>(`/${memberId}/published-items`),
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
      return memberFetch(`/${memberId}/social-schedule`, {
        method: 'POST',
        json: { packetId: selectedPacketId, cadence, platforms: selectedPlatforms },
      });
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
