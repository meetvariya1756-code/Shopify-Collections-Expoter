import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0B0F19',
      color: '#F8FAFC',
      padding: 24,
      textAlign: 'center'
    }}>
      <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>404 - Page Not Found</h2>
      <p style={{ color: '#94A3B8', marginBottom: 24 }}>The requested page could not be found.</p>
      <Link
        href="/"
        style={{
          background: '#6366F1',
          color: '#FFF',
          padding: '10px 20px',
          borderRadius: 10,
          textDecoration: 'none',
          fontWeight: 600
        }}
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
