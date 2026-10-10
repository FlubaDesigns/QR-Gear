import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowLeft, Download, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { memberFetch } from '@/lib/memberFetch';
import { adminFetch } from '@/lib/adminFetch';
import { GRF_IMAGE_ACCEPT_TYPES, GRF_VIDEO_ACCEPT_TYPES, GRF_IMAGE_MAX_MB, GRF_VIDEO_MAX_MB } from '@shared/GRF_engine';
import SEO from '@/components/SEO';

interface LibraryAsset {
  id: string;
  name: string;
  mediaType?: string;
  assetType?: string;
  publicUrl: string;
  thumbnailUrl?: string;
}

function AssetCard({ asset }: { asset: LibraryAsset }) {
  const [downloading, setDownloading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const { toast } = useToast();
  const download = async () => {
    setDownloading(true);
    try {
      const response = await fetch(asset.publicUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not download this file. Refresh and try again.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = asset.name || 'download';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast({ title: 'Download failed', description: (error as Error).message, variant: 'destructive' });
    } finally { setDownloading(false); }
  };
  return <article className="row rounded-lg border p-3 min-w-0" data-testid="library-asset">
    <div className="aspect-[4/3] overflow-hidden rounded bg-muted flex items-center justify-center">
      {previewFailed ? <p role="alert" className="text-sm p-3">Preview unavailable. Try downloading the file.</p>
        : asset.mediaType === 'video'
          ? <video src={asset.publicUrl} controls preload="metadata" className="h-full w-full object-contain" onError={() => setPreviewFailed(true)} />
          : <img src={asset.thumbnailUrl || asset.publicUrl} alt={asset.name} loading="lazy" className="h-full w-full object-contain" onError={() => setPreviewFailed(true)} />}
    </div>
    <p className="font-medium break-words">{asset.name}</p>
    <Button variant="outline" className="min-h-12" onClick={download} disabled={downloading}>
      {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download
    </Button>
  </article>;
}

export default function MemberLibrary() {
  const { firebaseUser, isAdmin } = useAuth();
  const memberId = firebaseUser?.uid;
  const input = useRef<HTMLInputElement>(null);
  const sharedInput = useRef<HTMLInputElement>(null);
  const [sharedProgress, setSharedProgress] = useState('');
  const client = useQueryClient();
  const { toast } = useToast();
  const personal = useQuery({
    queryKey: ['/api/members', memberId, 'library'],
    queryFn: () => memberFetch<{ assets: LibraryAsset[] }>(`/${memberId}/library`),
    enabled: !!memberId,
  });
  const shared = useQuery({
    queryKey: ['/api/members/common-library', 'all'],
    queryFn: () => memberFetch<{ assets: LibraryAsset[] }>('/common-library?assetType=all'),
    enabled: !!memberId,
  });
  const sharedUpload = useMutation({
    mutationFn: async (files: File[]) => {
      let saved = 0;
      const failures: string[] = [];
      for (const [index, file] of Array.from(files.entries())) {
        setSharedProgress(`Uploading ${index + 1} of ${files.length}: ${file.name}`);
        try {
          const maxMB = file.type.startsWith('video/') ? GRF_VIDEO_MAX_MB : GRF_IMAGE_MAX_MB;
          if (file.size > maxMB * 1024 * 1024) throw new Error(`Choose a file of ${maxMB} MB or smaller.`);
          const imageData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Could not read the file.'));
            reader.readAsDataURL(file);
          });
          await adminFetch('/common-library/upload', { method: 'POST', json: { imageData, mimeType: file.type, originalFilename: file.name } });
          saved++;
        } catch (error) { failures.push(`${file.name}: ${(error as Error).message}`); }
      }
      setSharedProgress(`${saved} of ${files.length} files saved to the shared library.${failures.length ? ` Failed: ${failures.join('; ')}` : ''}`);
      await client.invalidateQueries({ queryKey: ['/api/members/common-library'] });
      if (failures.length) throw new Error(`${failures.length} files could not be added. See the upload details.`);
    },
    onError: error => toast({ title: 'Some shared uploads failed', description: error.message, variant: 'destructive' }),
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 25 * 1024 * 1024) throw new Error('Choose a file smaller than 25 MB.');
      const imageData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('This file could not be read.'));
        reader.readAsDataURL(file);
      });
      return memberFetch(`/${memberId}/library/upload`, { method: 'POST', json: {
        imageData, mimeType: file.type, originalName: file.name, name: file.name,
        assetType: file.type.startsWith('video/') ? 'video' : 'background',
      } });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['/api/members', memberId, 'library'] });
      toast({ title: 'Upload saved', description: 'This file is in your private library.' });
    },
    onError: error => toast({ title: 'Upload failed', description: error.message, variant: 'destructive' }),
  });
  return <div className="row w-full min-w-0" data-testid="member-library">
    <SEO title="My Library | QR Gear" description="Your private uploads and shared starter images and videos." />
    <div className="row">
      <Link href="/members"><Button variant="ghost" className="min-h-12"><ArrowLeft className="mr-2 h-4 w-4" />Back to dashboard</Button></Link>
      <h1 className="text-2xl font-bold">My Library</h1>
      <p className="text-muted-foreground">Upload your own files or download a shared image or video to get started. You choose what goes into your products.</p>
    </div>
    <div className="layout__split-2">
      <Card className="min-w-0">
        <CardHeader><CardTitle>My private uploads</CardTitle><p className="text-sm text-muted-foreground">Only you can access these originals. When you publish a product, its chosen artwork and media become visible with that product.</p></CardHeader>
        <CardContent className="row">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" className="hidden" aria-label="Upload a private image or video" onChange={event => {
            const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = '';
          }} />
          <Button onClick={() => input.current?.click()} disabled={upload.isPending} className="min-h-12">
            {upload.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Upload image or video
          </Button>
          <p className="text-xs text-muted-foreground">PNG, JPEG, WebP, GIF, MP4 or WebM · up to 25 MB</p>
          {personal.isPending ? <p role="status">Loading your uploads…</p> : personal.error ? <div role="alert" className="row"><p>Could not load your private uploads.</p><Button variant="outline" onClick={() => void personal.refetch()}>Retry uploads</Button></div>
            : personal.data?.assets.length ? <div className="layout__auto">{personal.data.assets.map(asset => <AssetCard key={asset.id} asset={asset} />)}</div>
              : <p className="text-muted-foreground">Your private library is empty. Upload a file to begin.</p>}
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader><CardTitle>Shared starter library</CardTitle><p className="text-sm text-muted-foreground">Images and videos specifically shared by QR Gear for every member to use. You choose which ones to use in your products.</p></CardHeader>
        <CardContent className="row">
          {isAdmin && <div className="row">
            <input ref={sharedInput} type="file" multiple accept={`${GRF_IMAGE_ACCEPT_TYPES},${GRF_VIDEO_ACCEPT_TYPES}`} className="hidden" aria-label="Add files to the shared starter library" onChange={event => {
              const files = Array.from(event.target.files || []); if (files.length) sharedUpload.mutate(files); event.target.value = '';
            }} />
            <Button variant="outline" className="min-h-12" disabled={sharedUpload.isPending} onClick={() => sharedInput.current?.click()}>
              {sharedUpload.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Add shared images or videos
            </Button>
            <p className="text-sm text-muted-foreground">Admin: files added here are available to every member.</p>
            {sharedProgress && <p role={sharedUpload.isError ? 'alert' : 'status'} className="text-sm break-words">{sharedProgress}</p>}
          </div>}
          {shared.isPending ? <p role="status">Loading shared files…</p> : shared.error ? <div role="alert" className="row"><p>Could not load the shared starter library.</p><Button variant="outline" onClick={() => void shared.refetch()}>Retry shared files</Button></div>
            : shared.data?.assets.length ? <><p className="text-sm text-muted-foreground">{shared.data.assets.filter(asset => asset.mediaType === 'image').length} images · {shared.data.assets.filter(asset => asset.mediaType === 'video').length} videos</p><div className="layout__auto">{shared.data.assets.map(asset => <AssetCard key={asset.id} asset={asset} />)}</div></>
              : <p className="text-muted-foreground">No shared starter files have been added yet.</p>}
        </CardContent>
      </Card>
    </div>
  </div>;
}
