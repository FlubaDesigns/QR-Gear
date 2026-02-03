import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Upload, Library, User, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { GridView, type GridViewItem } from "./views/GridView";
import { CropUtility, type CropAsset } from "./utilities/CropUtility";
import { useToast } from "@/hooks/use-toast";

interface LibraryAsset {
  id: string;
  name: string;
  assetType: string;
  mediaType: string;
  thumbnailUrl: string;
  publicUrl: string;
  width?: number | null;
  height?: number | null;
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

function assetToGridItem(asset: LibraryAsset): GridViewItem {
  return {
    id: asset.id,
    name: asset.name,
    imageUrl: asset.thumbnailUrl || asset.publicUrl,
    dimensions: asset.width && asset.height ? `${asset.width}x${asset.height}` : undefined,
  };
}

export function BackgroundLibraryPicker({
  memberId,
  selectedUrl,
  onSelect,
  onClose,
  assetType = 'background'
}: BackgroundLibraryPickerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<'common' | 'personal'>('personal');
  const [uploading, setUploading] = useState(false);
  
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [assetToCrop, setAssetToCrop] = useState<CropAsset | null>(null);

  const fetchImageBlob = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };

  const { data: commonAssets = [], isLoading: loadingCommon } = useQuery({
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

  const { data: personalAssets = [], isLoading: loadingPersonal } = useQuery({
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

  const deleteMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const res = await fetch(`/api/members/${memberId}/library/${assetId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders()
      });
      if (!res.ok) throw new Error('Delete failed');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Image deleted" });
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'library'] });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
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
      setActiveTab('personal');
      
      if (data.asset) {
        setAssetToCrop({
          id: data.asset.id,
          name: data.asset.name || 'Uploaded Image',
          imageUrl: data.asset.publicUrl,
        });
        setCropDialogOpen(true);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    }
  });

  const commonGridItems = useMemo(() => commonAssets.map(assetToGridItem), [commonAssets]);
  const personalGridItems = useMemo(() => personalAssets.map(assetToGridItem), [personalAssets]);

  const allAssets = useMemo(() => [...commonAssets, ...personalAssets], [commonAssets, personalAssets]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleGridSelect = (item: GridViewItem) => {
    const asset = allAssets.find(a => a.id === item.id);
    if (asset) {
      setAssetToCrop({
        id: asset.id,
        name: asset.name,
        imageUrl: asset.publicUrl,
      });
      setCropDialogOpen(true);
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
    setCropDialogOpen(false);
    setAssetToCrop(null);
  };

  const saveCroppedMutation = useMutation({
    mutationFn: async ({ croppedData, originalAsset }: { croppedData: string; originalAsset: CropAsset }) => {
      const headers = await getAuthHeaders();
      
      // Save the cropped version
      const croppedRes = await fetch(`/api/members/${memberId}/library/upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          assetType,
          name: `${originalAsset.name} (cropped)`,
          imageData: croppedData,
          mimeType: 'image/jpeg',
          originalName: `${originalAsset.name}_cropped.jpg`
        })
      });
      if (!croppedRes.ok) throw new Error('Failed to save cropped image');
      
      // If from common library, also save the original to personal
      const isFromPersonal = personalAssets.some(a => a.id === originalAsset.id);
      if (!isFromPersonal) {
        const originalBlob = await fetch(originalAsset.imageUrl).then(r => r.blob());
        const reader = new FileReader();
        const originalData = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(originalBlob);
        });
        
        await fetch(`/api/members/${memberId}/library/upload`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            assetType,
            name: originalAsset.name,
            imageData: originalData,
            mimeType: 'image/jpeg',
            originalName: originalAsset.name
          })
        });
      }
      
      return croppedRes.json();
    },
    onSuccess: () => {
      toast({ title: "Saved to your library" });
      queryClient.invalidateQueries({ queryKey: ['/api/members', memberId, 'library'] });
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    }
  });

  const handleCropComplete = async (croppedUrl: string) => {
    onSelect(croppedUrl);
    
    // Save to library in background
    if (assetToCrop) {
      saveCroppedMutation.mutate({
        croppedData: croppedUrl,
        originalAsset: assetToCrop
      });
    }
    
    setCropDialogOpen(false);
    setAssetToCrop(null);
  };

  const isPersonalAsset = (id: string) => personalAssets.some(a => a.id === id);

  return (
    <>
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Library className="w-5 h-5" />
              {assetType === 'background' ? 'Background Library' : 'Video Library'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Choose from the library or upload your own images
            </DialogDescription>
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
                Admin-curated backgrounds available to all members.
              </p>
              <div className="max-h-[400px] overflow-y-auto">
                <GridView
                  items={commonGridItems}
                  onSelect={handleGridSelect}
                  isLoading={loadingCommon}
                  emptyMessage="No common backgrounds available"
                  columns="grid-cols-3"
                />
              </div>
            </TabsContent>

            <TabsContent value="personal" className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-slate-400">
                  {personalAssets.length} uploaded background{personalAssets.length !== 1 ? 's' : ''}
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
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                <GridView
                  items={personalGridItems}
                  onSelect={handleGridSelect}
                  isLoading={loadingPersonal}
                  emptyMessage="No uploads yet. Click Upload to add images."
                  columns="grid-cols-3"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-700">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-library">
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CropUtility
        asset={assetToCrop}
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open);
          if (!open) setAssetToCrop(null);
        }}
        onCropComplete={handleCropComplete}
        onDelete={assetToCrop && isPersonalAsset(assetToCrop.id) ? handleDelete : undefined}
        isDeleting={deleteMutation.isPending}
        fetchImageBlob={fetchImageBlob}
        aspectRatio={9 / 16}
        title="Crop Background"
        allowCropToggle={true}
      />
    </>
  );
}
