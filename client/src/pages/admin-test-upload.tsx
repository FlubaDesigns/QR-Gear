import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Check, X, RefreshCw } from "lucide-react";

export default function AdminTestUpload() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
    console.log(`[TestUpload] ${msg}`);
  };

  useEffect(() => {
    addLog("Setting up auth listener...");
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      addLog(firebaseUser ? `Auth ready: ${firebaseUser.email}` : "Auth ready: No user");
    });
    return () => unsubscribe();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      setError(null);
      addLog(`File selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      addLog("Starting upload...");
      
      if (!user) {
        throw new Error("Not logged in - please log in first");
      }

      addLog("Getting Firebase token...");
      const token = await user.getIdToken();
      addLog(`Token received: ${token ? token.substring(0, 20) + "..." : "NONE"}`);

      addLog("Converting file to base64...");
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });
      addLog(`Base64 ready: ${base64.length} chars`);

      const body = {
        name: selectedFile.name.replace(/\.[^/.]+$/, ""),
        assetType: "source",
        imageData: base64,
        mimeType: selectedFile.type || "image/png",
      };

      addLog("Sending POST to /api/admin/background-assets...");

      const response = await fetch("/api/admin/background-assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      addLog(`Response status: ${response.status}`);

      const data = await response.json();
      addLog(`Response: ${JSON.stringify(data).substring(0, 100)}...`);

      if (!response.ok) {
        throw new Error(data.error || data.message || `Server error ${response.status}`);
      }

      setResult(data);
      addLog("Upload successful!");
    } catch (err: any) {
      console.error("[TestUpload] Error:", err);
      addLog(`ERROR: ${err.message}`);
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const clearLogs = () => setLogs([]);

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-2xl font-bold mb-6">Test Upload Page</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Auth Status</CardTitle>
        </CardHeader>
        <CardContent>
          {authLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking auth...</span>
            </div>
          ) : user ? (
            <div className="space-y-1 text-sm">
              <p className="text-green-600 font-medium">Logged in</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>UID:</strong> {user.uid}</p>
            </div>
          ) : (
            <p className="text-destructive">Not logged in - go to /login first</p>
          )}
        </CardContent>
      </Card>

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
              disabled={uploading || !user}
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
            disabled={!selectedFile || uploading || !user}
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
          <CardTitle className="flex items-center justify-between">
            <span>Logs</span>
            <Button size="sm" variant="ghost" onClick={clearLogs}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-3 rounded font-mono text-xs max-h-64 overflow-auto">
            {logs.length === 0 ? (
              <span className="text-muted-foreground">No logs yet</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={log.includes("ERROR") ? "text-destructive" : ""}>
                  {log}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
