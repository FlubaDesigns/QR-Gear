import { useState } from "react";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Check, X, FileArchive } from "lucide-react";

export default function AdminTestUpload() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      console.log("[TestUpload] Token:", token ? "present" : "missing");
      console.log("[TestUpload] File:", selectedFile.name, selectedFile.type, selectedFile.size);

      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      console.log("[TestUpload] Base64 length:", base64.length);

      const body = {
        name: selectedFile.name.replace(/\.[^/.]+$/, ""),
        assetType: "source",
        imageData: base64,
        mimeType: selectedFile.type || "image/png",
      };

      console.log("[TestUpload] Sending to /api/admin/background-assets");

      const response = await fetch("/api/admin/background-assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(body),
      });

      console.log("[TestUpload] Response status:", response.status);

      const data = await response.json();
      console.log("[TestUpload] Response data:", data);

      if (!response.ok) {
        throw new Error(data.error || `Server error ${response.status}`);
      }

      setResult(data);
    } catch (err: any) {
      console.error("[TestUpload] Error:", err);
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-2xl font-bold mb-6">Test Upload Page</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-file">Select Image</Label>
            <Input
              id="test-file"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading}
              className="h-12"
              data-testid="input-test-file"
            />
          </div>

          {selectedFile && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {selectedFile.type} - {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full"
            data-testid="button-upload"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <X className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap">{error}</pre>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="mb-6 border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              Success
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap bg-muted p-3 rounded overflow-auto max-h-64">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Auth User:</strong> {auth.currentUser?.email || "Not logged in"}</p>
            <p><strong>User ID:</strong> {auth.currentUser?.uid || "N/A"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
