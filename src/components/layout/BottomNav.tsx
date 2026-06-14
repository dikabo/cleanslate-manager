import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  LayoutDashboard,
  ClipboardList,
  Plus,
  Users,
  Package,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Accueil", href: "/" },
  { icon: ClipboardList, label: "Commandes", href: "/orders" },
  { icon: Plus, label: "Nouvelle", href: "/orders/new", isAction: true },
  { icon: Users, label: "Clients", href: "/clients" },
  { icon: Package, label: "Stocks", href: "/stock" },
];

export function BottomNav() {
  const isMobile = useIsMobile();
  const location = useLocation();

  if (!isMobile) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-lg border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors",
                item.isAction
                  ? "relative -mt-4"
                  : isActive
                    ? "text-primary"
                    : "text-muted-foreground"
              )}
            >
              {item.isAction ? (
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg">
                  <item.icon className="h-6 w-6" />
                </div>
              ) : (
                <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              )}
              <span
                className={cn(
                  "text-[10px] leading-tight",
                  item.isAction ? "mt-0.5 text-primary font-medium" : "",
                  isActive && !item.isAction && "font-semibold text-primary"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
