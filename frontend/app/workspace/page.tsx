'use client';

import dynamic from 'next/dynamic';
import AuthGuard from '@/components/AuthGuard';
import ChatPanel from '@/components/ChatPanel';

// Dynamically import ThreeScene to avoid SSR issues with Three.js
const ThreeScene = dynamic(() => import('@/components/ThreeScene'), {
  ssr: false,
  loading: () => (
    <div style={loadingStyles.container}>
      <p style={loadingStyles.text}>Loading 3D Scene...</p>
    </div>
  ),
});

export default function WorkspacePage() {
  return (
    <AuthGuard>
      <WorkspaceContent />
    </AuthGuard>
  );
}

function WorkspaceContent() {
  return (
    <div style={styles.container}>
      <div style={styles.sceneArea}>
        <ThreeScene />
      </div>
      <div style={styles.chatArea}>
        <ChatPanel />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'grid',
    gridTemplateColumns: '1fr 350px',
    gap: '1rem',
    padding: '1rem',
    height: 'calc(100vh - 60px)',
    overflow: 'hidden',
  },
  sceneArea: {
    height: '100%',
    minHeight: '400px',
  },
  chatArea: {
    height: '100%',
    minHeight: '400px',
  },
};

const loadingStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '400px',
    background: '#0a0a0a',
    borderRadius: '8px',
    border: '1px solid #262626',
  },
  text: {
    color: '#a1a1a1',
    fontSize: '0.9rem',
  },
};
