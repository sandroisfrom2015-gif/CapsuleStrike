import { useCallback, useEffect, useState } from 'react';
import { supabase, usernameToEmail } from '@/lib/supabase';

export interface AuthUser {
  id: string;
  username: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('player_profiles')
            .select('username')
            .eq('id', session.user.id)
            .maybeSingle();
          setUser({ id: session.user.id, username: profile?.username ?? 'Player' });
        } else {
          setUser(null);
        }
        setLoading(false);
      })();
    });
  }, []);

  const signUp = useCallback(async (username: string, password: string) => {
    const email = usernameToEmail(username);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      const { error: profileErr } = await supabase
        .from('player_profiles')
        .insert({ id: data.user.id, username });
      if (profileErr) return { error: profileErr.message };
    }
    return { error: null };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const email = usernameToEmail(username);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return { user, loading, signUp, signIn, signOut };
}
