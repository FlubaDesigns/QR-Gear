import { Button } from "@/components/ui/button";
import { Building2, Users, Globe } from "lucide-react";
import { useStoreLibraryContext, StoreType } from "../StoreLibraryContext";

const storeTypes: { type: StoreType; label: string; icon: typeof Building2 }[] = [
  { type: "internal", label: "Internal", icon: Building2 },
  { type: "external", label: "External", icon: Globe },
  { type: "member", label: "Member", icon: Users },
];

export function StoreTypeFilterModule() {
  const { selectedType, setSelectedType } = useStoreLibraryContext();

  return (
    <div className="flex gap-2" data-testid="module-store-type-filter">
      {storeTypes.map(({ type, label, icon: Icon }) => (
        <Button
          key={type}
          variant={selectedType === type ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType(type)}
          className="flex-1"
          data-testid={`button-type-${type}`}
        >
          <Icon className="h-4 w-4 mr-2" />
          {label}
        </Button>
      ))}
    </div>
  );
}
