import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { DeviceAdminDetails } from '../../types/api_types.js';
import {
  Cpu,
  Key,
  RefreshCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  AlertTriangle,
  Edit2,
  Database,
  Clock,
  Activity,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';

interface NodeManagementPanelProps {
  currentDeviceId?: number;
  onSelectDevice?: (deviceId: number) => void;
}

export const NodeManagementPanel: React.FC<NodeManagementPanelProps> = ({
  currentDeviceId,
  onSelectDevice,
}) => {
  const { token } = useAuth();
  const [nodes, setNodes] = useState<DeviceAdminDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Key visibility toggles (node id -> boolean)
  const [revealedKeys, setRevealedKeys] = useState<Record<number, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);

  // Inline rename state
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  // Register Modal state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCustomApiKey, setNewCustomApiKey] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [registeredSuccessInfo, setRegisteredSuccessInfo] = useState<{
    id: number;
    name: string;
    apiKey: string;
  } | null>(null);

  // Action Confirmation Modals
  const [purgeTarget, setPurgeTarget] = useState<DeviceAdminDetails | null>(null);
  const [isPurging, setIsPurging] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DeviceAdminDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [rotateTarget, setRotateTarget] = useState<DeviceAdminDetails | null>(null);
  const [isRotating, setIsRotating] = useState(false);

  const fetchNodes = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/devices', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to load hardware nodes (HTTP ${res.status})`);
      }

      const data = await res.json();
      setNodes(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Error fetching nodes');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const toggleKeyVisibility = (nodeId: number) => {
    setRevealedKeys((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleCopyKey = async (nodeId: number, key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKeyId(nodeId);
      setTimeout(() => setCopiedKeyId(null), 2500);
    } catch {
      // Fallback
    }
  };

  const handleStartRename = (node: DeviceAdminDetails) => {
    setEditingNodeId(node.id);
    setEditingName(node.name);
  };

  const handleSaveRename = async (nodeId: number) => {
    if (!editingName.trim()) return;
    setError(null);

    try {
      const res = await fetch(`/api/v1/devices/${nodeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: editingName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to rename node');
      }

      showSuccess(`Node #${nodeId} renamed to "${data.name}"`);
      setEditingNodeId(null);
      fetchNodes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRegisterNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsSubmittingNew(true);
    setError(null);

    try {
      const payload: { name: string; apiKey?: string } = { name: newName.trim() };
      if (newCustomApiKey.trim()) {
        payload.apiKey = newCustomApiKey.trim();
      }

      const res = await fetch('/api/v1/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to register node');
      }

      setRegisteredSuccessInfo({
        id: data.id,
        name: data.name,
        apiKey: data.apiKey,
      });
      setNewName('');
      setNewCustomApiKey('');
      fetchNodes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleConfirmRotate = async () => {
    if (!rotateTarget) return;
    setIsRotating(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/devices/${rotateTarget.id}/api-key/rotate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to rotate API key');
      }

      showSuccess(`API Key for Node #${rotateTarget.id} successfully rotated`);
      setRotateTarget(null);
      // Auto reveal new key
      setRevealedKeys((prev) => ({ ...prev, [rotateTarget.id]: true }));
      fetchNodes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRotating(false);
    }
  };

  const handleConfirmPurge = async () => {
    if (!purgeTarget) return;
    setIsPurging(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/devices/${purgeTarget.id}/measurements`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to purge measurements');
      }

      showSuccess(`Purged ${data.deleted_records} measurements for Node #${purgeTarget.id}`);
      setPurgeTarget(null);
      fetchNodes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPurging(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/devices/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to decommission node');
      }

      showSuccess(`Node #${deleteTarget.id} decommissioned and deleted`);
      setDeleteTarget(null);
      fetchNodes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 rounded-xl shadow-inner">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">
              HARDWARE NODES &amp; API KEY CREDENTIALS
            </h3>
            <p className="text-xs text-slate-400">
              Provision ESP32-S3 microphone arrays, rotate cryptographic ingestion keys, and manage historical data storage.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchNodes}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
            title="Refresh node inventory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              setRegisteredSuccessInfo(null);
              setIsRegisterOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-md shadow-emerald-950/50"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Node</span>
          </button>
        </div>
      </div>

      {/* Alert banners */}
      {error && (
        <div className="flex items-center gap-2 p-3 text-xs bg-rose-950/70 border border-rose-800 text-rose-300 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 p-3 text-xs bg-emerald-950/70 border border-emerald-800 text-emerald-300 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Node Cards Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {nodes.map((node) => {
          const isSelected = currentDeviceId === node.id;
          const isKeyRevealed = Boolean(revealedKeys[node.id]);
          const isEditing = editingNodeId === node.id;
          const isOnline = node.status === 'online';

          return (
            <div
              key={node.id}
              className={`bg-slate-950/70 border rounded-xl p-4 flex flex-col justify-between gap-4 transition shadow-md ${
                isSelected
                  ? 'border-emerald-500/80 ring-1 ring-emerald-500/30'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Card Header: Node ID, Name, Online Badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
                      NODE #{node.id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
                        isOnline
                          ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                        }`}
                      />
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.5 rounded">
                        ACTIVE STREAM
                      </span>
                    )}
                  </div>

                  {/* Name or inline editor */}
                  <div className="mt-2">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="px-2.5 py-1 text-xs bg-slate-900 border border-emerald-500 rounded text-white focus:outline-none w-full max-w-xs font-semibold"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(node.id);
                            if (e.key === 'Escape') setEditingNodeId(null);
                          }}
                        />
                        <button
                          onClick={() => handleSaveRename(node.id)}
                          className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold transition"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingNodeId(null)}
                          className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <h4 className="text-sm font-bold text-white tracking-wide">{node.name}</h4>
                        <button
                          onClick={() => handleStartRename(node)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                          title="Rename node"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {onSelectDevice && !isSelected && (
                  <button
                    onClick={() => onSelectDevice(node.id)}
                    className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-semibold transition"
                  >
                    Switch Radar
                  </button>
                )}
              </div>

              {/* Node Stats Metrics Pill Grid */}
              <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-900/60 border border-slate-800/80 rounded-lg text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> Clock Sync
                  </span>
                  <span className="font-bold text-slate-300 text-[11px] truncate block mt-0.5">
                    {node.clock_status || 'MONOTONIC'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                    <Activity className="w-3 h-3 text-slate-400" /> Sample Rate
                  </span>
                  <span className="font-bold text-slate-300 text-[11px] block mt-0.5">
                    {(node.sample_rate || 48000) / 1000} kHz
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                    <Database className="w-3 h-3 text-slate-400" /> Stored Events
                  </span>
                  <span className="font-bold text-emerald-400 text-[11px] block mt-0.5">
                    {(node.total_events || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* API Key Credential Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" /> Ingestion API Key
                  </span>
                  <button
                    onClick={() => setRotateTarget(node)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1 transition"
                  >
                    Rotate Key
                  </button>
                </div>

                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-xs">
                  <span className="flex-1 truncate text-slate-300 select-all">
                    {node.api_key
                      ? isKeyRevealed
                        ? node.api_key
                        : '••••••••••••••••••••••••••••••••'
                      : '<Hidden>'}
                  </span>

                  <button
                    onClick={() => toggleKeyVisibility(node.id)}
                    className="p-1 text-slate-400 hover:text-white transition"
                    title={isKeyRevealed ? 'Hide API Key' : 'Reveal API Key'}
                  >
                    {isKeyRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>

                  {node.api_key && (
                    <button
                      onClick={() => handleCopyKey(node.id, node.api_key!)}
                      className="p-1 text-slate-400 hover:text-emerald-400 transition"
                      title="Copy API Key"
                    >
                      {copiedKeyId === node.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom Card Actions: Purge Data & Decommission */}
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs">
                <div className="text-[11px] text-slate-500 font-mono">
                  {node.last_seen_at
                    ? `Seen: ${new Date(node.last_seen_at).toLocaleTimeString()}`
                    : 'Never connected'}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPurgeTarget(node)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950/80 border border-rose-900/60 rounded-lg font-medium transition"
                    title="Purge historical telemetry measurements for this node"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Purge Data</span>
                  </button>

                  <button
                    onClick={() => setDeleteTarget(node)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                    title="Decommission & delete node"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {nodes.length === 0 && !loading && (
        <div className="text-center py-12 text-slate-500 space-y-2">
          <Cpu className="w-8 h-8 mx-auto text-slate-600" />
          <p className="text-sm">No hardware nodes found.</p>
        </div>
      )}

      {/* ================= REGISTER MODAL ================= */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Register Hardware Node</h3>
              </div>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {registeredSuccessInfo ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-emerald-950/50 border border-emerald-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Node Provisioned Successfully!</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Assigned <strong>Node #{registeredSuccessInfo.id}</strong> (
                    {registeredSuccessInfo.name}).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                    Assigned Ingestion API Key
                  </label>
                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-xs text-emerald-400 select-all">
                    <span className="flex-1 truncate">{registeredSuccessInfo.apiKey}</span>
                    <button
                      onClick={() => handleCopyKey(registeredSuccessInfo.id, registeredSuccessInfo.apiKey)}
                      className="p-1 hover:text-white transition"
                    >
                      {copiedKeyId === registeredSuccessInfo.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Set this API key in your ESP32 firmware (<code className="text-slate-400 font-mono">DOA_API_KEY</code>) to authenticate binary telemetry uploads.
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setIsRegisterOpen(false)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterNode} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Node Name / Location
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ESP32-S3 Array Lab B"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      API Key (Optional)
                    </label>
                    <span className="text-[11px] text-slate-500">Auto-generated if blank</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Leave empty to auto-generate a secure key"
                    value={newCustomApiKey}
                    onChange={(e) => setNewCustomApiKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsRegisterOpen(false)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingNew || !newName.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                  >
                    {isSubmittingNew ? 'Registering...' : 'Register Node'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================= PURGE CONFIRMATION MODAL ================= */}
      {purgeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-rose-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-950 text-rose-400 rounded-xl border border-rose-800 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Purge Historical Data?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  You are about to permanently delete all stored telemetry measurements for{' '}
                  <strong className="text-slate-200">
                    Node #{purgeTarget.id} ({purgeTarget.name})
                  </strong>
                  .
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-950/30 border border-rose-900/40 rounded-xl text-xs text-rose-300 space-y-1">
              <p className="font-semibold">⚠️ Caution: Irreversible Database Purge</p>
              <p className="text-slate-400">
                Currently holding{' '}
                <strong className="text-white">
                  {(purgeTarget.total_events || 0).toLocaleString()} records
                </strong>
                . This will immediately reset the acoustic heatmap and historical stats for this node. Active hardware telemetry stream will remain uninterrupted.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                onClick={() => setPurgeTarget(null)}
                disabled={isPurging}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPurge}
                disabled={isPurging}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
              >
                {isPurging ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Purging...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Purge Measurements</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ROTATE API KEY CONFIRMATION MODAL ================= */}
      {rotateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-amber-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-amber-950 text-amber-400 rounded-xl border border-amber-800 shrink-0">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Rotate Ingestion API Key?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Rotating the API key for{' '}
                  <strong className="text-slate-200">
                    Node #{rotateTarget.id} ({rotateTarget.name})
                  </strong>{' '}
                  will instantly invalidate the current key.
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-950/30 border border-amber-900/40 rounded-xl text-xs text-amber-300 space-y-1">
              <p className="font-semibold">⚠️ Requires Hardware Firmware Update</p>
              <p className="text-slate-400">
                Any ESP32 sending binary measurement batches with the old key will be rejected with HTTP 401 until re-flashed or configured with the newly generated key.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                onClick={() => setRotateTarget(null)}
                disabled={isRotating}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRotate}
                disabled={isRotating}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
              >
                {isRotating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Rotating Key...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-3.5 h-3.5" />
                    <span>Confirm Key Rotation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE NODE CONFIRMATION MODAL ================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-rose-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-950 text-rose-400 rounded-xl border border-rose-800 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Decommission Hardware Node?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  You are about to decommission and delete{' '}
                  <strong className="text-slate-200">
                    Node #{deleteTarget.id} ({deleteTarget.name})
                  </strong>
                  .
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-950/30 border border-rose-900/40 rounded-xl text-xs text-rose-300 space-y-1">
              <p className="font-semibold">⚠️ Full Node Removal</p>
              <p className="text-slate-400">
                This will delete the node entry, its calibration settings, and all associated telemetry records permanently.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Decommission Node</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeManagementPanel;
