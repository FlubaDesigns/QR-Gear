import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Upload, Library, User, Check, X, Image as ImageIcon } from "lucide-react";
import { auth } from "@/lib/firebase";

interface LibraryAsset {
  id: number;
  name: string;
  assetType: string;
  mediaType: string;
  thumbnailUrl: string;
  publicUrl: string;
  width?: number | null;
  height?: number | null;
  category?: string | null;
  sourceAssetId?: number | null;
}

interface BackgroundLibraryPickerProps {
  memberId: string;
  selectedUrl: string | null;
  onSelect: (url: string) => void;
  onClose: () => void;
  assetType?: 'background' | 'video';
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export function BackgroundLibraryPicker({
  memberId,
  selectedUrl,
  onSelect,
  onClose,
  assetType = 'background'
}: BackgroundLibraryPickerProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'common' | 'personal'>('common');
  const [uploading, setUploading] = useState(false);

  const { data: commonAssets, isLoading: loadingCommon } = useQuery({
    queryKey: ['/api/members/common-library', assetType],
    queryFn: async () => {
      const res = await fetch(`/api/members/common-library?assetType=${assetType}`, {
        headers: await getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch common library');
      const data = await res.json();
      return data.assets as LibraryAsset[];
    }
  });

  const { data: personalAssets, isLoading: loadingPersonal } = useQuery({
    queryKey: ['/api/members', memberId, 'library', assetType],
    queryFn: async () => {
      const res = await fetch(`/api/members/${memberId}/library?assetType=${assetType}`, {
        headers: await getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch personal library');
      const data = await res.json();
      return data.assets as LibraryAsset[];
    },
    enabled: !!memberId
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const imageData = await base64Promise;

      const res = await fetch(`/api/members/${memberId}/library/upload`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          assetType,
          name: file.name,
          imageData,
          mimeType: file.type,
          originalName: file.name
        })
      });
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'library'] });
      if (data.asset?.publicUrl) {
        onSelect(data.asset.publicUrl);
      }
      setActiveTab('personal');
    }
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSelect = (asset: LibraryAsset) => {
    onSelect(asset.publicUrl);
  };

  const renderAssetGrid = (assets: LibraryAsset[] | undefined, loading: boolean, emptyMessage: string) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      );
    }

    if (!assets || assets.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
          <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
          <p>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-1">
        {assets.map((asset) => {
          const isSelected = selectedUrl === asset.publicUrl;
          return (
            <button
              key={asset.id}
              onClick={() => handleSelect(asset)}
              className={`relative aspect-[9/16] rounded-lg overflow-hidden border-2 transition-all hover-elevate ${
                isSelected ? 'border-primary ring-2 ring-primary/50' : 'border-transparent'
              }`}
              data-testid={`library-asset-${asset.id}`}
            >
              <img
                src={asset.thumbnailUrl || asset.publicUrl}
                alt={asset.name}
                className="w-full h-full object-cover"
              />
              {isSelected && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <Check className="w-8 h-8 text-white" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <p className="text-xs text-white truncate">{asset.name}</p>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Library className="w-5 h-5" />
            {assetType === 'background' ? 'Background Library' : 'Video Library'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'common' | 'personal')}>
          <TabsList className="grid w-full grid-cols-2 bg-slate-800">
            <TabsTrigger value="common" className="flex items-center gap-2" data-testid="tab-common-library">
              <Library className="w-4 h-4" />
              Common Library
            </TabsTrigger>
            <TabsTrigger value="personal" className="flex items-center gap-2" data-testid="tab-personal-library">
              <User className="w-4 h-4" />
              My Library
            </TabsTrigger>
          </TabsList>

          <TabsContent value="common" className="mt-4">
            <p className="text-sm text-slate-400 mb-3">
              Choose from admin-curated backgrounds available to all members.
            </p>
            {renderAssetGrid(commonAssets, loadingCommon, 'No common backgrounds available')}
          </TabsContent>

          <TabsContent value="personal" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-400">
                Your uploaded backgrounds.
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept={assetType === 'video' ? 'video/*' : 'image/*'}
                className="hidden"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                data-testid="button-upload-to-library"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Upload
              </Button>
            </div>
            {renderAssetGrid(personalAssets, loadingPersonal, 'No uploads yet')}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-700">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-library">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={onClose} data-testid="button-confirm-library">
            <Check className="w-4 h-4 mr-2" />
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
