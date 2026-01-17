'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LandingPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/home');
    }
  }, [user, router]);

  if (isLoading) {
    return (
      <div style={styles.container}>
        <p style={styles.loading}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.hero}>
        <h1 style={styles.title}>MCHacks</h1>
        <p style={styles.subtitle}>
          Build amazing 3D experiences with collaborative tools
        </p>

        {!user && (
          <a href="/api/auth/login" style={styles.loginButton}>
            Login to Get Started
          </a>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 60px)',
    padding: '2rem',
  },
  hero: {
    textAlign: 'center',
    maxWidth: '600px',
  },
  title: {
    fontSize: '3.5rem',
    fontWeight: 700,
    marginBottom: '1rem',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '1.25rem',
    color: '#a1a1a1',
    marginBottom: '2rem',
    lineHeight: 1.6,
  },
  loginButton: {
    display: 'inline-block',
    padding: '1rem 2rem',
    background: '#3b82f6',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    transition: 'background 0.2s',
  },
  loading: {
    color: '#a1a1a1',
    fontSize: '1rem',
  },
};
