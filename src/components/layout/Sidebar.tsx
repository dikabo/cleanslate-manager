import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo-cleanup.jpg";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Package,
  Truck,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  Building,
  TrendingUp,
  Receipt,
  HeartHandshake,
  LogOut,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

const mainMenuItems = [
  { icon: LayoutDashboard, label: "Tableau de Bord", href: "/" },
  { icon: ClipboardList, label: "Commandes", href: "/orders" },
  { icon: Users, label: "Clients", href: "/clients" },
  { icon: Package, label: "Stocks", href: "/stock" },
];

const partnerMenuItems = [
  { icon: Building, label: "Partenaires", href: "/partners" },
  { icon: Truck, label: "Logistique", href: "/partner-logistics" },
  { icon: TrendingUp, label: "Performance", href: "/performance" },
];

const adminMenuItems = [
  { icon: HeartHandshake, label: "Fidelite", href: "/loyalty" },
  { icon: Receipt, label: "Charges", href: "/charges" },
  { icon: BarChart3, label: "Rapports", href: "/reports" },
  { icon: Settings, label: "Paramètres", href: "/settings" },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

export function Sidebar({ mobileOpen, onMobileClose, collapsed = false, onCollapseChange }: SidebarProps) {
  const location = useLocation();
  const { user, signOut, isAdminOrManager } = useAuth();
  const isMobile = useIsMobile();

  const handleNavClick = () => {
    if (isMobile && onMobileClose) onMobileClose();
  };

  const renderMenuItem = (item: typeof mainMenuItems[0]) => {
    const isActive = location.pathname === item.href;
    return (
      <li key={item.href}>
        <Link
          to={item.href}
          onClick={handleNavClick}
          className={cn(
            "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 touch-target",
            isActive
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-primary")} />
          {(!collapsed || isMobile) && (
            <span className="animate-fade-in">{item.label}</span>
          )}
        </Link>
      </li>
    );
  };

  // Mobile: overlay drawer
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onMobileClose}
          />
        )}
        {/* Drawer */}
        <aside
          className={cn(
            "fixed left-0 top-0 z-50 h-screen w-72 bg-card border-r border-border flex flex-col transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Header with close */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Clean Up" className="h-10 w-auto object-contain" />
              <div>
                <h1 className="font-display font-bold text-lg text-foreground leading-tight">Clean Up</h1>
                <p className="text-xs text-muted-foreground">Manager</p>
              </div>
            </div>
            <button onClick={onMobileClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* New Order */}
          <div className="p-4">
            <Link to="/orders/new" onClick={handleNavClick}>
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md touch-target">
                <Plus className="h-5 w-5" />
                <span className="ml-2">Nouvelle Commande</span>
              </Button>
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-2 overflow-y-auto">
            <ul className="space-y-1">{mainMenuItems.map(renderMenuItem)}</ul>
            <div className="mt-4">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Partenaires</p>
              <ul className="space-y-1">{partnerMenuItems.map(renderMenuItem)}</ul>
            </div>
            {isAdminOrManager && (
              <div className="mt-4">
                <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Administration</p>
                <ul className="space-y-1">{adminMenuItems.map(renderMenuItem)}</ul>
              </div>
            )}
          </nav>

          {/* User & Logout */}
          <div className="p-4 border-t border-border space-y-2">
            {user && <div className="text-sm text-muted-foreground truncate px-2">{user.email}</div>}
            <button
              onClick={() => signOut()}
              className="w-full flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-sm">Déconnexion</span>
            </button>
          </div>
        </aside>
      </>
    );
  }

  // Desktop: fixed sidebar
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-card border-r border-border transition-all duration-300 flex flex-col",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <img src={logo} alt="Clean Up" className="h-12 w-auto object-contain" />
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="font-display font-bold text-lg text-foreground leading-tight">Clean Up</h1>
            <p className="text-xs text-muted-foreground">Manager</p>
          </div>
        )}
      </div>

      {/* New Order Button */}
      <div className="p-4">
        <Link to="/orders/new">
          <Button className={cn("w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all touch-target", collapsed ? "px-3" : "")}>
            <Plus className="h-5 w-5" />
            {!collapsed && <span className="ml-2">Nouvelle Commande</span>}
          </Button>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        <ul className="space-y-1">{mainMenuItems.map(renderMenuItem)}</ul>
        <div className="mt-4">
          {!collapsed && <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Partenaires</p>}
          {collapsed && <Separator className="my-2" />}
          <ul className="space-y-1">{partnerMenuItems.map(renderMenuItem)}</ul>
        </div>
        {isAdminOrManager && (
          <div className="mt-4">
            {!collapsed && <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Administration</p>}
            {collapsed && <Separator className="my-2" />}
            <ul className="space-y-1">{adminMenuItems.map(renderMenuItem)}</ul>
          </div>
        )}
      </nav>

      {/* User & Logout */}
      <div className="p-4 border-t border-border space-y-2">
        {user && !collapsed && <div className="text-sm text-muted-foreground truncate px-2">{user.email}</div>}
        <button
          onClick={() => signOut()}
          className={cn("w-full flex items-center gap-2 py-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10", collapsed ? "justify-center" : "px-3")}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="text-sm">Déconnexion</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <div className="p-4 border-t border-border">
        <button
          onClick={() => onCollapseChange?.(!collapsed)}
          className="w-full flex items-center justify-center gap-2 py-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : (
            <>
              <ChevronLeft className="h-5 w-5" />
              <span className="text-sm">Réduire</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
