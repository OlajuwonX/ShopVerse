import { ShoppingBag, User, type LucideIcon } from "lucide-react";

import { WishlistLink } from "@/components/navigation/WishlistLink";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";

type HeaderAction = {
  available: boolean;
  icon: LucideIcon;
  label: string;
};

const headerActions: readonly HeaderAction[] = [
  { available: false, icon: ShoppingBag, label: "Cart" },
  { available: false, icon: User, label: "Account" },
];

type HeaderActionsProps = {
  className?: string;
};

export function HeaderActions({ className }: HeaderActionsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <WishlistLink />

      {headerActions.map((action) => {
        const Icon = action.icon;

        return (
          <IconButton
            aria-label={
              action.available ? action.label : `${action.label}, available soon`
            }
            disabled={!action.available}
            key={action.label}
            variant="ghost"
          >
            <Icon aria-hidden="true" className="size-5" />
          </IconButton>
        );
      })}
    </div>
  );
}
