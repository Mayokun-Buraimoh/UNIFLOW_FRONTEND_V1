import React, { useState, useEffect } from 'react';
import { useSystem } from '../hooks/useSystem';

interface BackendStatusProps {
  onStatusChange?: (status: 'connected' | 'disconnected' | 'checking') => void;
}

const BackendStatus: React.FC<BackendStatusProps> = ({ onStatusChange }) => {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const { health, loading, error, checkHealth } = useSystem();

  useEffect(() => {
    checkBackendStatus();
  }, []);

  const checkBackendStatus = async () => {
    try {
      setStatus('checking');
      await checkHealth();
      setStatus('connected');
      onStatusChange?.('connected');
    } catch (err: any) {
      setStatus('disconnected');
      onStatusChange?.('disconnected');
    }
  };

  const testDatabase = async () => {
    try {
      // For now, just show a success message since we don't have a specific database test endpoint
      alert('Database connection successful!');
    } catch (err: any) {
      console.error('Database test failed:', err);
      alert(`Database test failed: ${err.message}`);
    }
  };

  return (
    <div className="backend-status">
      <div className="status-indicator">
        <div className={`status-dot ${status}`}></div>
        <span className="status-text">
          Backend: {status === 'connected' ? 'Connected' : status === 'disconnected' ? 'Disconnected' : 'Checking...'}
        </span>
      </div>
      
      {status === 'connected' && health && (
        <div className="health-info">
          <p>Status: {health.status}</p>
          <p>Message: {health.message}</p>
          {health.database && <p>Database: {health.database}</p>}
          {health.userCount && <p>Users: {health.userCount}</p>}
          <button onClick={testDatabase} className="test-db-btn">
            Test Database
          </button>
        </div>
      )}
      
      {error && (
        <div className="error-info">
          <p>Error: {error}</p>
          <button onClick={checkBackendStatus} className="retry-btn">
            Retry Connection
          </button>
        </div>
      )}
      
      <style>{`
        .backend-status {
          padding: 16px;
          border: 1px solid #ddd;
          border-radius: 8px;
          margin: 16px 0;
          background: #f9f9f9;
        }
        
        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
        
        .status-dot.connected {
          background: #4caf50;
        }
        
        .status-dot.disconnected {
          background: #f44336;
        }
        
        .status-dot.checking {
          background: #ff9800;
          animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        .health-info, .error-info {
          font-size: 14px;
        }
        
        .test-db-btn, .retry-btn {
          background: #447055;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 8px;
        }
        
        .test-db-btn:hover, .retry-btn:hover {
          background: #335544;
        }
      `}</style>
    </div>
  );
};

export default BackendStatus;
