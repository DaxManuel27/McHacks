'use client';

import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';

export default function NavBar() {
  const { user, isLoading } = useUser();

  return (
    <nav style={styles.nav}>
      <Link href="/" style={styles.logo}>
        MCHacks
      </Link>

      <div style={styles.links}>
        {user && (
          <>
            <Link href="/home" style={styles.link}>
              Home
            </Link>
            <Link href="/workspace" style={styles.link}>
              Workspace
            </Link>
          </>
        )}
      </div>

      <div style={styles.auth}>
        {isLoading ? (
          <span style={styles.loading}>...</span>
        ) : user ? (
          <a href="/api/auth/logout" style={styles.button}>
            Logout
          </a>
        ) : (
          <a href="/api/auth/login" style={styles.button}>
            Login
          </a>
        )}
      </div>
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 2rem',
    background: '#141414',
    borderBottom: '1px solid #262626',
  },
  logo: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#fafafa',
  },
  links: {
    display: 'flex',
    gap: '1.5rem',
  },
  link: {
    color: '#a1a1a1',
    fontSize: '0.9rem',
    transition: 'color 0.2s',
  },
  auth: {
    display: 'flex',
    alignItems: 'center',
  },
  button: {
    padding: '0.5rem 1rem',
    background: '#3b82f6',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  loading: {
    color: '#a1a1a1',
  },
};
