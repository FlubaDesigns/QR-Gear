import { Settings, Type, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TestSettings() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Test Settings</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              Font Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Manage the fonts available in the product builder text editor.
            </p>
            
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                TODO: Implement font management
              </p>
              <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                <li>Add new fonts to the font picker list</li>
                <li>Remove fonts from the font picker list</li>
                <li>Reorder fonts (most used at top)</li>
                <li>Preview fonts before adding</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button disabled data-testid="button-add-font">
                <Plus className="h-4 w-4 mr-2" />
                Add Font
              </Button>
              <Button variant="outline" disabled data-testid="button-delete-font">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Font
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
