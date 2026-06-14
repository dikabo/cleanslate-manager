import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const { user, roles, rolesError, isLoading } = useAuth();
  const showRolesWarning = !isLoading && !!user && roles.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapseChange={setSidebarCollapsed}
      />
      <div className={cn(
        "transition-all duration-300",
        isMobile ? "" : sidebarCollapsed ? "pl-20" : "pl-64"
      )}>
        <Header onMenuToggle={() => setMobileMenuOpen(true)} />
        <main className={cn("p-4 md:p-6", isMobile && "pb-24")}>
          {showRolesWarning && (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>Roles utilisateur introuvables</AlertTitle>
              <AlertDescription>
                Votre session est ouverte, mais aucun role n&apos;a ete charge pour ce compte.
                Les menus d&apos;administration et les donnees peuvent donc etre masques.
                Verifiez la table <code>public.user_roles</code> pour l&apos;utilisateur connecte.
                {rolesError ? ` Detail technique: ${rolesError}` : ""}
              </AlertDescription>
            </Alert>
          )}
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
