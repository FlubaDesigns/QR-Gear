import { useState, useRef, useEffect } from 'react';
import { Upload, FolderPlus, FolderOpen, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IMAGE_LIBRARY_ACCEPT, IMAGE_LIBRARY_MAX_MB } from '@shared/imageLibrary';
import { useAdminImages, useAdminImageFolders, useAdminImageUpload, adminImageToSkinItem } from '../adminImageLibrary';
import { SinglePaneViewer } from './viewers/SinglePaneViewer';
import { ScrollGridView } from './views/ScrollGridView';
import { AdminImageCardSkin } from './skins/AdminImageSkin';
import { AdminImageShape } from './shapes/AdminImageShape';
import { CreateImageFolderDialog } from './CreateImageFolderDialog';
import { ArchiveAdminImageDialog } from './ArchiveAdminImageDialog';

/** Shared Library and builder picker: one collection, folder state, previews and actions. */
export function AdminImagesBrowser({ onSelect }: { onSelect?: (url: string) => void }) {
  const [folder, setFolder] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<ReturnType<typeof useAdminImageUpload>['mutateAsync']>> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const images = useAdminImages(folder); const folders = useAdminImageFolders(); const upload = useAdminImageUpload();
  const items = (images.data || []).map(adminImageToSkinItem);
  const selected = items.find(item => item.id === selectedId) || null;
  useEffect(() => { if (images.data && selectedId && !images.data.some(image => image.id === selectedId)) setSelectedId(null); }, [images.data, selectedId]);
  return <SinglePaneViewer>
    <p className="text-sm text-muted-foreground mb-4">Images for website content and product designs.</p>
    <input ref={fileInput} type="file" accept={IMAGE_LIBRARY_ACCEPT} multiple className="hidden" onChange={async event => {
      const files = Array.from(event.target.files || []); event.target.value = '';
      if (!files.length || uploading.current) return;
      uploading.current = true; setResult(null);
      try { setResult(await upload.mutateAsync({ files: files.map(file => ({ file, name: file.name })), folder: folder || 'general' })); }
      finally { uploading.current = false; }
    }} />
    <div className="flex flex-wrap gap-2 mb-2">
      {folder && <Button variant="outline" className="min-h-[44px]" onClick={() => { setFolder(null); setSelectedId(null); }}><ArrowLeft className="h-4 w-4" />All images</Button>}
      <Button variant="outline" className="min-h-[44px]" disabled={upload.isPending} onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4" />{upload.isPending ? 'Uploading…' : 'Upload'}</Button>
      <Button variant="outline" className="min-h-[44px]" onClick={() => setCreatingFolder(true)}><FolderPlus className="h-4 w-4" />New folder</Button>
    </div>
    <p className="text-xs text-muted-foreground mb-4">PNG, JPEG, WebP, SVG · Up to {IMAGE_LIBRARY_MAX_MB} MB each</p>
    {result && <div role="status" className="p-3 mb-4 rounded border"><p>{result.uploaded.length} uploaded{result.failed.length ? `; ${result.failed.length} failed` : ''}.</p>{result.failed.map((failure, index) => <p key={index} className="text-sm text-destructive break-words">{failure.name}: {failure.message}</p>)}</div>}
    {(images.error || folders.error) && <p role="alert" className="text-destructive mb-3">{images.error?.message || folders.error?.message}</p>}
    {!folder && <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">{folders.data?.map(name => <Button key={name} variant="outline" className="min-h-[44px] h-auto whitespace-normal break-words" onClick={() => setFolder(name)}><FolderOpen className="h-4 w-4" />{name}</Button>)}</div>}
    <h3 className="text-base font-semibold mb-3">{folder || 'All images'} ({items.length})</h3>
    <ScrollGridView items={items} isLoading={images.isLoading} height="auto" columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" footer={null} emptyMessage="No images here yet."
      renderItem={item => <AdminImageCardSkin item={item} onClick={() => setSelectedId(item.id)} />} />
    <AdminImageShape item={selected} onClose={() => setSelectedId(null)} onArchive={setArchiveId} pending={!!archiveId} onSelect={onSelect} />
    <CreateImageFolderDialog open={creatingFolder} onClose={() => setCreatingFolder(false)} onCreated={setFolder} />
    <ArchiveAdminImageDialog imageId={archiveId} onClose={() => setArchiveId(null)} onArchived={id => { if (id === selectedId) setSelectedId(null); }} />
  </SinglePaneViewer>;
}
