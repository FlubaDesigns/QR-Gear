import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Globe, User, ShoppingBag } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useProductsContext } from "../ProductsContext";
import type { RoleType } from "../shared/types";

const ROLE_ICONS: Record<RoleType, React.ReactNode> = {
  internal: <Building2 className="h-4 w-4" />,
  marketplace: <ShoppingBag className="h-4 w-4" />,
  partner: <Globe className="h-4 w-4" />,
  external: <Globe className="h-4 w-4" />,
  member: <User className="h-4 w-4" />,
};

export function RolePickerModule() {
  const { roles, selectedRole, setSelectedRole, setSelectedStore, setSelectedChannel } = useProductsContext();

  const handleRoleChange = (roleId: RoleType) => {
    if (selectedRole === roleId) {
      setSelectedRole(null);
      setSelectedStore(null);
      setSelectedChannel(null);
    } else {
      setSelectedRole(roleId);
      setSelectedStore(null);
      setSelectedChannel(null);
    }
  };

  return (
    <CollapsibleModule
      title="Role"
      icon={<Building2 className="h-4 w-4" />}
      defaultOpen={true}
    >
      <div className="flex flex-wrap gap-3">
        {roles.map((role) => {
          const isSelected = selectedRole === role.id;
          return (
            <Button
              key={role.id}
              variant={isSelected ? "default" : "outline"}
              className="flex items-center gap-2"
              onClick={() => handleRoleChange(role.id)}
              data-testid={`button-role-${role.id}`}
            >
              {ROLE_ICONS[role.id]}
              <span>{role.name}</span>
              {isSelected && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  Active
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
      {selectedRole && (
        <p className="text-sm text-muted-foreground mt-3">
          {roles.find(r => r.id === selectedRole)?.description}
        </p>
      )}
    </CollapsibleModule>
  );
}

export default RolePickerModule;
