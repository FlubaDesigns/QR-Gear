import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CollapsibleModuleProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function CollapsibleModule({
  title,
  icon,
  children,
  defaultOpen = true,
  className = "",
}: CollapsibleModuleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={`${className}`}>
      <CardHeader
        className="py-3 px-4 cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
        data-testid={`collapsible-header-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <CardTitle className="text-base flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      {isOpen && <CardContent className="pt-0 px-4 pb-4">{children}</CardContent>}
    </Card>
  );
}

export default CollapsibleModule;
