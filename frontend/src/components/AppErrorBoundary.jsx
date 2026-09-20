import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  state = { failed: false, message: '' };

  static getDerivedStateFromError(error) {
    return { failed: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error, info) {
    console.error('FullCourt rendering failed:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f7f7f5', color: '#18181b' }}>
        <section role="alert" style={{ maxWidth: 440, padding: 32, borderRadius: 20, background: '#fff', border: '1px solid #e3e3e8' }}>
          <p style={{ color: '#c8102e', fontWeight: 800 }}>FullCourt</p>
          <h1 style={{ fontSize: 26 }}>Let’s get you back on court.</h1>
          <p style={{ color: '#52525b' }}>This page couldn’t finish loading. Reload to try again. Unsaved form entries may need to be entered again.</p>
          {import.meta.env.DEV && this.state.message && (
            <div style={{ padding: 12, marginBottom: 16, background: '#fff1f3', border: '1px solid #f2cbd2', borderRadius: 8 }}>
              <strong style={{ fontSize: 13 }}>Error details</strong>
              <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12, color: '#8f1025' }}>{this.state.message}</pre>
            </div>
          )}
          <button type="button" onClick={() => window.location.reload()} style={{ padding: '12px 20px', background: '#c8102e', color: '#fff', border: 0, borderRadius: 10, fontWeight: 700 }}>Reload FullCourt</button>
        </section>
      </main>
    );
  }
}
