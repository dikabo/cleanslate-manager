import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = 'super_admin' | 'manager' | 'receptionist' | 'artisan' | 'delivery' | 'partner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  roles: AppRole[];
  rolesError: string | null;
  hasRole: (role: AppRole) => boolean;
  isAdminOrManager: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [rolesError, setRolesError] = useState<string | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Fetch user roles
          setTimeout(async () => {
            const { data: userRoles, error: rolesError } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id);

            console.log('[AuthContext] user_id:', session.user.id);
            console.log('[AuthContext] userRoles:', userRoles, 'error:', rolesError);

            if (userRoles) {
              setRoles(userRoles.map(r => r.role as AppRole));
              setRolesError(null);
            } else if (rolesError) {
              setRoles([]);
              setRolesError(rolesError.message);
            }
          }, 0);
        } else {
          setRoles([]);
          setRolesError(null);
        }

        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .then(({ data: userRoles, error: rolesError }) => {
            if (userRoles) {
              setRoles(userRoles.map(r => r.role as AppRole));
              setRolesError(null);
            } else if (rolesError) {
              setRoles([]);
              setRolesError(rolesError.message);
            }
            setIsLoading(false);
          });
      } else {
        setRolesError(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasRole = (role: AppRole) => roles.includes(role);

  const isAdminOrManager = roles.includes('super_admin') || roles.includes('manager');

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName }
      }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
    setRolesError(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      roles,
      rolesError,
      hasRole,
      isAdminOrManager,
      signIn,
      signUp,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
