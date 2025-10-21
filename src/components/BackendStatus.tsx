import React, { useState, useEffect } from 'react';

interface BackendStatusProps {
  apiUrl?: string;
}

const BackendStatus: React.FC<BackendStatusProps> = ({
  apiUrl = 'http://localhost:3001',
}) => {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>(
    'checking'
  );
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkBackendStatus = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/health`);
      if (response.ok) {
        setStatus('online');
      } else {
        setStatus('offline');
      }
    } catch (error) {
      setStatus('offline');
    }
    setLastChecked(new Date());
  };

  useEffect(() => {
    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [apiUrl]);

  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'text-green-500';
      case 'offline':
        return 'text-red-500';
      default:
        return 'text-yellow-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
      default:
        return 'Checking...';
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <div
        className={`w-3 h-3 rounded-full ${getStatusColor().replace('text-', 'bg-')}`}
      ></div>
      <span className={`text-sm font-medium ${getStatusColor()}`}>
        Backend: {getStatusText()}
      </span>
      {lastChecked && (
        <span className="text-xs text-gray-500">
          (Last checked: {lastChecked.toLocaleTimeString()})
        </span>
      )}
    </div>
  );
};

export default BackendStatus;
