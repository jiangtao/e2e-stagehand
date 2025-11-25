'use client';

import { useState, useEffect } from 'react';

export default function UserInfo() {
  const [userInfo, setUserInfo] = useState<{ userId: string; username?: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await fetch('/api/user/info');
      const result = await response.json();
      if (result.success) {
        setUserInfo(result.data);
        setUsername(result.data.username || '');
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    }
  };

  const handleSaveUsername = async () => {
    try {
      const response = await fetch('/api/user/info', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username || undefined }),
      });

      const result = await response.json();
      if (result.success) {
        setUserInfo(result.data);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to update username:', error);
      alert('更新用户名失败');
    }
  };

  if (!userInfo) {
    return null;
  }

  return (
    <div className="flex items-center space-x-3 text-sm">
      {isEditing ? (
        <>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="输入用户名"
            className="input-field text-sm py-1 px-2"
            autoFocus
          />
          <button
            onClick={handleSaveUsername}
            className="btn-secondary text-xs py-1 px-2"
          >
            保存
          </button>
          <button
            onClick={() => {
              setIsEditing(false);
              setUsername(userInfo.username || '');
            }}
            className="btn-secondary text-xs py-1 px-2"
          >
            取消
          </button>
        </>
      ) : (
        <>
          <span className="text-gray-600 dark:text-gray-400">
            {userInfo.username || `用户 ${userInfo.userId.slice(0, 8)}...`}
          </span>
          <button
            onClick={() => setIsEditing(true)}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-xs"
          >
            编辑
          </button>
        </>
      )}
    </div>
  );
}

