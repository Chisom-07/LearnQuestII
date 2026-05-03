import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  user_id: string;
  display_name: string;
  class_level: string;
  avatar_url: string | null;
  enrollment_status: string;
  is_active: boolean;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error || !data) return null;
    return data as unknown as Profile;
  };

  const fetchRole = async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    return data?.some((r) => r.role === "admin") ?? false;
  };

  const forceSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  }, []);

  const checkSingleDevice = useCallback(async (
    currentSession: Session,
    userId: string,
    adminStatus: boolean
  ): Promise<boolean> => {
    if (adminStatus) return true;
    const tokenSuffix = currentSession.access_token.slice(-20);
    const { data: activeSession } = await supabase
      .from("active_sessions")
      .select("session_token")
      .eq("user_id", userId)
      .single();

    if (activeSession && activeSession.session_token !== tokenSuffix) {
      await forceSignOut();
      return false;
    }
    return true;
  }, [forceSignOut]);

  const checkActiveStatus = useCallback(async (userId: string, adminStatus: boolean) => {
    if (adminStatus) return;
    const { data } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("user_id", userId)
      .single();
    if (data && !data.is_active) {
      await forceSignOut();
    }
  }, [forceSignOut]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const [p, admin] = await Promise.all([fetchProfile(user.id), fetchRole(user.id)]);
    setProfile(p);
    setIsAdmin(admin);
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!isMounted) return;
      if (initialSession?.user) {
        const [p, admin] = await Promise.all([
          fetchProfile(initialSession.user.id),
          fetchRole(initialSession.user.id),
        ]);
        if (!isMounted) return;
        setSession(initialSession);
        setUser(initialSession.user);
        setProfile(p);
        setIsAdmin(admin);
        await checkSingleDevice(initialSession, initialSession.user.id, admin);
      }
      if (isMounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!isMounted) return;
        if (newSession?.user) {
          const [p, admin] = await Promise.all([
            fetchProfile(newSession.user.id),
            fetchRole(newSession.user.id),
          ]);
          if (!isMounted) return;
          setSession(newSession);
          setUser(newSession.user);
          setProfile(p);
          setIsAdmin(admin);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
        }
        if (isMounted) setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [checkSingleDevice]);

  useEffect(() => {
    if (!session || !user) return;
    const interval = setInterval(async () => {
      const stillValid = await checkSingleDevice(session, user.id, isAdmin);
      if (stillValid) await checkActiveStatus(user.id, isAdmin);
    }, 30_000);
    return () => clearInterval(interval);
  }, [session, user, isAdmin, checkSingleDevice, checkActiveStatus]);

  const signOut = async () => {
    if (user) {
      await supabase.from("active_sessions").delete().eq("user_id", user.id);
    }
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, isAdmin, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
