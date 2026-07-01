import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import { LogIn, LogOut, UserPlus, Cpu, AlertTriangle, ShieldCheck } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  
  // Auth Form State
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  
  // Portfolio state
  const [portfolio, setPortfolio] = useState({ holdings: [], riskMetrics: {} });
  
  // UX states
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [backendHealth, setBackendHealth] = useState({ status: 'unknown', database: '' });

  // Clear notifications after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Check Backend health on mount
  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then(res => res.json())
      .then(data => {
        setBackendHealth({ status: 'online', database: data.database });
      })
      .catch(() => {
        setBackendHealth({ status: 'offline', database: '' });
      });
  }, []);

  // Fetch portfolio when token changes
  useEffect(() => {
    if (token) {
      fetchPortfolio();
    } else {
      setPortfolio({ holdings: [], riskMetrics: {} });
    }
  }, [token]);

  const fetchPortfolio = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/portfolio`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
      } else {
        const data = await res.json();
        triggerNotification('error', data.msg || 'Failed to fetch portfolio.');
        if (res.status === 401) handleLogout();
      }
    } catch (err) {
      triggerNotification('error', 'Unable to connect to backend server. Make sure node backend is running on port 5000.');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerNotification = (type, message) => {
    setNotification({ type, message });
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput) return;

    setIsLoading(true);
    const endpoint = isRegisterMode ? 'register' : 'login';
    try {
      const res = await fetch(`${API_BASE}/users/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        setUsernameInput('');
        setPasswordInput('');
        triggerNotification('success', `Welcome back, ${data.user.username}!`);
      } else {
        triggerNotification('error', data.msg || 'Authentication failed.');
      }
    } catch (err) {
      triggerNotification('error', 'Connection error. Check that backend Express server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    triggerNotification('success', 'Logged out successfully.');
  };

  const handleAddHolding = async (ticker, shares, buyPrice) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/portfolio/holdings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ticker, shares, buyPrice })
      });
      const data = await res.json();

      if (res.ok) {
        setPortfolio(data);
        triggerNotification('success', `Added ${ticker.toUpperCase()} holding successfully.`);
      } else {
        triggerNotification('error', data.msg || 'Failed to add holding.');
      }
    } catch (err) {
      triggerNotification('error', 'Network error. Could not add holding.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveHolding = async (ticker) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/portfolio/holdings/${ticker}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (res.ok) {
        setPortfolio(data);
        triggerNotification('success', `Removed ${ticker} holding successfully.`);
      } else {
        triggerNotification('error', data.msg || 'Failed to remove holding.');
      }
    } catch (err) {
      triggerNotification('error', 'Network error. Could not remove holding.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzePortfolio = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE}/portfolio/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (res.ok) {
        // The API returns the metrics, holdings, report, and logs. We merge it with portfolio
        setPortfolio(prev => ({
          ...prev,
          riskMetrics: {
            beta: data.metrics.beta,
            volatility: data.metrics.volatility,
            valueAtRisk: data.metrics.valueAtRisk,
            diversificationScore: data.metrics.diversificationScore,
            lastAnalyzed: new Date().toISOString(),
            agentReport: data.agentReport,
            agentLogs: data.agentLogs
          }
        }));
        triggerNotification('success', 'AI agents completed risk re-analysis!');
      } else {
        triggerNotification('error', data.msg || 'Failed to re-analyze.');
      }
    } catch (err) {
      triggerNotification('error', 'Network error running multi-agent risk assessment.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // IF NOT AUTHENTICATED: Render Register/Login panel
  if (!token || !user) {
    return (
      <div className="app-container">
        <header>
          <div className="logo-container">
            <div className="logo-badge">
              <Cpu size={18} />
            </div>
            <div className="logo-text">Investment<span>Risk</span></div>
          </div>
        </header>

        <div className="auth-wrapper">
          <div className="glass-card auth-card">
            <div className="auth-header">
              <h2>{isRegisterMode ? 'Create AI Account' : 'AI Risk Portal'}</h2>
              <p>{isRegisterMode ? 'Register to manage portfolios and invoke AI agents' : 'Log in to audit stock portfolios using multi-agent RAG pipeline'}</p>
            </div>

            {notification && (
              <div className={`notification notification-${notification.type}`}>
                {notification.type === 'error' ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
                {notification.message}
              </div>
            )}

            <form onSubmit={handleAuthSubmit}>
              <div className="form-group">
                <label>Username</label>
                <input 
                  type="text" 
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="input-field" 
                  placeholder="Enter username" 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input 
                  type="password" 
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="input-field" 
                  placeholder="••••••••" 
                  required 
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '10px' }}
                disabled={isLoading}
              >
                {isLoading ? <span className="spinner"></span> : (isRegisterMode ? <UserPlus size={16} /> : <LogIn size={16} />)}
                {isRegisterMode ? 'Register Account' : 'Secure Login'}
              </button>
            </form>

            <div className="auth-footer">
              {isRegisterMode ? 'Already have an account?' : 'New to the platform?'}
              <button 
                onClick={() => { setIsRegisterMode(!isRegisterMode); setNotification(null); }} 
                className="auth-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', outline: 'none' }}
              >
                {isRegisterMode ? 'Login here' : 'Register here'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // IF AUTHENTICATED: Render main dashboard
  return (
    <div className="app-container">
      <header>
        <div className="logo-container">
          <div className="logo-badge">
            <Cpu size={18} />
          </div>
          <div className="logo-text">Investment<span>Risk</span></div>
        </div>

        <div className="header-user">
          <span 
            className="user-tag" 
            style={{ 
              color: backendHealth.status === 'online' ? '#34d399' : '#f87171',
              borderColor: backendHealth.status === 'online' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              background: backendHealth.status === 'online' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
              display: 'flex',
              alignHeight: 'center',
              gap: '6px'
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: backendHealth.status === 'online' ? '#10b981' : '#ef4444', display: 'inline-block', alignSelf: 'center' }}></span>
            API: {backendHealth.status.toUpperCase()} {backendHealth.database === 'fallback-json-file' ? '(LOCAL FILE DB)' : ''}
          </span>
          <span className="user-tag">👤 {user.username}</span>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </header>

      {/* Main dashboard content */}
      <Dashboard 
        portfolio={portfolio} 
        onAddHolding={handleAddHolding}
        onRemoveHolding={handleRemoveHolding}
        onAnalyzePortfolio={handleAnalyzePortfolio}
        isActionLoading={isLoading}
        isAnalyzing={isAnalyzing}
        notification={notification}
      />
    </div>
  );
}
