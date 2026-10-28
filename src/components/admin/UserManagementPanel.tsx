import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { UserRecord, UserRole } from '../../types/api_types.js';
import { Users, Shield, User, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export const UserManagementPanel: React.FC = () => {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/users', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to load users (HTTP ${res.status})`);
      }

      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Error loading users');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: number, newRole: UserRole) => {
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/v1/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to update user role');
      }

      setSuccessMsg(data.message || 'User role updated');
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!window.confirm(`Are you sure you want to delete user '${username}'?`)) {
      return;
    }

    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/v1/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to delete user');
      }

      setSuccessMsg(`User '${username}' deleted`);
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-purple-950/80 border border-purple-800/80 text-purple-400 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              ADMIN CONTROL: USER & ROLE MANAGEMENT
            </h3>
            <p className="text-xs text-slate-400">
              Manage system permissions, promote viewers to administrators, and revoke accounts.
            </p>
          </div>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 text-xs bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 p-3 text-xs bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <th className="pb-2.5 px-2">ID</th>
              <th className="pb-2.5 px-2">Username</th>
              <th className="pb-2.5 px-2">Email</th>
              <th className="pb-2.5 px-2">Role</th>
              <th className="pb-2.5 px-2">Created</th>
              <th className="pb-2.5 px-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {users.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  No registered users found
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isCurrent = currentUser?.id === u.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-2 font-mono text-slate-400">#{u.id}</td>
                    <td className="py-2.5 px-2 font-semibold text-slate-200">
                      <div className="flex items-center gap-1.5">
                        {u.role === 'admin' ? (
                          <Shield className="w-3.5 h-3.5 text-purple-400" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>{u.username}</span>
                        {isCurrent && (
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                            YOU
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-slate-400 font-mono">{u.email}</td>
                    <td className="py-2.5 px-2">
                      <select
                        value={u.role}
                        disabled={isCurrent}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        className={`text-xs font-semibold py-1 px-2 rounded-md border focus:outline-none transition ${
                          u.role === 'admin'
                            ? 'bg-purple-950/80 border-purple-800 text-purple-300'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        } disabled:opacity-60 cursor-pointer`}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-2 text-slate-500 font-mono">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <button
                        onClick={() => handleDeleteUser(u.id, u.username)}
                        disabled={isCurrent}
                        title={isCurrent ? 'Cannot delete your own account' : 'Delete user account'}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagementPanel;
