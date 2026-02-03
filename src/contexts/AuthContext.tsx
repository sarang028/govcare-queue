import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Patient } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  patient: Patient | null;
  loading: boolean;
  signUp: (email: string, password: string, patientData: Omit<Patient, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshPatient: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPatient = async (userId: string) => {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching patient:', error);
      return null;
    }
    return data as Patient | null;
  };

  const refreshPatient = async () => {
    if (user) {
      const patientData = await fetchPatient(user.id);
      setPatient(patientData);
    }
  };

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Use setTimeout to avoid potential race conditions
          setTimeout(async () => {
            const patientData = await fetchPatient(session.user.id);
            setPatient(patientData);
            setLoading(false);
          }, 0);
        } else {
          setPatient(null);
          setLoading(false);
        }
      }
    );

    // Then get the initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchPatient(session.user.id).then((patientData) => {
          setPatient(patientData);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (
    email: string, 
    password: string, 
    patientData: Omit<Patient, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        }
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        // Create patient profile
        const { error: patientError } = await supabase
          .from('patients')
          .insert({
            user_id: data.user.id,
            ...patientData
          });

        if (patientError) throw patientError;
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setPatient(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      patient,
      loading,
      signUp,
      signIn,
      signOut,
      refreshPatient
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
