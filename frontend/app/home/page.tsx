'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import AuthGuard from '@/components/AuthGuard';
import Link from 'next/link';

export default function HomePage() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}

function HomeContent() {
  const { user } = useUser();

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>Project Home</h1>
        
        <div style={styles.userCard}>
          <p style={styles.greeting}>
            Welcome back, <strong>{user?.name || user?.email || 'User'}</strong>
          </p>
          {user?.email && (
            <p style={styles.email}>{user.email}</p>
          )}
        </div>

        <div style={styles.actions}>
          <Link href="/workspace" style={styles.workspaceButton}>
            Open Workspace
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '2rem',
    maxWidth: '800px',
    margin: '0 auto',
  },
  content: {
    marginTop: '2rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    marginBottom: '2rem',
    color: '#fafafa',
  },
  userCard: {
    background: '#141414',
    border: '1px solid #262626',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '2rem',
  },
  greeting: {
    fontSize: '1.125rem',
    color: '#fafafa',
    margin: 0,
  },
  email: {
    fontSize: '0.875rem',
    color: '#a1a1a1',
    marginTop: '0.5rem',
  },
  actions: {
    display: 'flex',
    gap: '1rem',
  },
  workspaceButton: {
    display: 'inline-block',
    padding: '0.75rem 1.5rem',
    background: '#3b82f6',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '0.9rem',
    fontWeight: 500,
  },
};
