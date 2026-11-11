import React, { useState } from 'react';
import { SpatialZone } from '../../types/api_types';
import { X, Plus, Trash2, MapPin, Save, RotateCcw } from 'lucide-react';

interface SpatialZoneEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  zones: SpatialZone[];
  onSave: (zones: SpatialZone[]) => Promise<{ success: boolean; error?: string }>;
}

const PRESET_BOARDROOM: SpatialZone[] = [
  { name: 'Podium / Stage', min_angle_deg: -30.0, max_angle_deg: 30.0, color: '#10b981', alert_threshold_db: 75.0 },
  { name: 'Audience Left', min_angle_deg: -90.0, max_angle_deg: -30.0, color: '#818cf8', alert_threshold_db: 75.0 },
  { name: 'Audience Right', min_angle_deg: 30.0, max_angle_deg: 90.0, color: '#38bdf8', alert_threshold_db: 75.0 },
  { name: 'Rear Gallery', min_angle_deg: 150.0, max_angle_deg: 180.0, color: '#f59e0b', alert_threshold_db: 75.0 },
];

const PRESET_AUDITORIUM: SpatialZone[] = [
  { name: 'Main Stage', min_angle_deg: -45.0, max_angle_deg: 45.0, color: '#10b981', alert_threshold_db: 80.0 },
  { name: 'Auditorium Floor', min_angle_deg: -120.0, max_angle_deg: 120.0, color: '#38bdf8', alert_threshold_db: 75.0 },
  { name: 'Balcony', min_angle_deg: 130.0, max_angle_deg: 180.0, color: '#ec4899', alert_threshold_db: 70.0 },
];

const PRESET_ROUNDTABLE: SpatialZone[] = [
  { name: 'North Chair', min_angle_deg: -45.0, max_angle_deg: 45.0, color: '#10b981', alert_threshold_db: 75.0 },
  { name: 'East Chair', min_angle_deg: 45.0, max_angle_deg: 135.0, color: '#38bdf8', alert_threshold_db: 75.0 },
  { name: 'West Chair', min_angle_deg: -135.0, max_angle_deg: -45.0, color: '#818cf8', alert_threshold_db: 75.0 },
  { name: 'South Chair', min_angle_deg: 135.0, max_angle_deg: -135.0, color: '#f59e0b', alert_threshold_db: 75.0 },
];

export const SpatialZoneEditorModal: React.FC<SpatialZoneEditorModalProps> = ({
  isOpen,
  onClose,
  zones: initialZones,
  onSave,
}) => {
  const [zones, setZones] = useState<SpatialZone[]>(initialZones);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdateZone = (index: number, field: keyof SpatialZone, value: any) => {
    const updated = [...zones];
    updated[index] = { ...updated[index], [field]: value };
    setZones(updated);
  };

  const handleAddZone = () => {
    setZones([
      ...zones,
      {
        name: `Zone ${zones.length + 1}`,
        min_angle_deg: 0,
        max_angle_deg: 45,
        color: '#10b981',
        alert_threshold_db: 75.0,
      },
    ]);
  };

  const handleRemoveZone = (index: number) => {
    setZones(zones.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);

    // Validate client-side
    for (const z of zones) {
      if (!z.name.trim()) {
        setErrorMessage('All zones must have a name');
        setSaving(false);
        return;
      }
      if (z.min_angle_deg === z.max_angle_deg) {
        setErrorMessage(`Zone '${z.name}': Min angle cannot equal Max angle (${z.min_angle_deg}°)`);
        setSaving(false);
        return;
      }
      if (z.min_angle_deg > z.max_angle_deg && !(z.min_angle_deg > 0 && z.max_angle_deg < 0)) {
        setErrorMessage(
          `Zone '${z.name}': Min angle (${z.min_angle_deg}°) cannot exceed Max angle (${z.max_angle_deg}°) unless wrapping across South (min > 0, max < 0)`
        );
        setSaving(false);
        return;
      }
    }

    const result = await onSave(zones);
    setSaving(false);
    if (result.success) {
      onClose();
    } else {
      setErrorMessage(result.error || 'Failed to save spatial zones');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-slate-100 text-base">
              Spatial Room Geofence & Zone Editor
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 rounded-lg">
              {errorMessage}
            </div>
          )}

          {/* Presets */}
          <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-medium">Quick Presets:</span>
            <button
              onClick={() => setZones(PRESET_BOARDROOM)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Standard Boardroom
            </button>
            <button
              onClick={() => setZones(PRESET_AUDITORIUM)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Auditorium
            </button>
            <button
              onClick={() => setZones(PRESET_ROUNDTABLE)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Roundtable 360
            </button>
          </div>

          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              💡 <span className="text-slate-300 font-medium">Circular Wrap-Around:</span> For sectors crossing South (±180°), set a positive start and negative end angle (e.g., <code className="text-cyan-400 font-mono">135°</code> to <code className="text-cyan-400 font-mono">-135°</code>).
            </span>
          </div>

          {/* Zones Form List */}
          <div className="space-y-3">
            {zones.map((zone, idx) => (
              <div
                key={idx}
                className="flex items-center space-x-2 p-3 bg-slate-950 border border-slate-800 rounded-lg"
              >
                {/* Color picker */}
                <input
                  type="color"
                  value={zone.color}
                  onChange={(e) => handleUpdateZone(idx, 'color', e.target.value)}
                  className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer"
                  title="Zone Color"
                />

                {/* Name */}
                <input
                  type="text"
                  placeholder="Zone Name"
                  value={zone.name}
                  onChange={(e) => handleUpdateZone(idx, 'name', e.target.value)}
                  className="w-36 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />

                {/* Min Angle */}
                <div className="flex items-center space-x-1">
                  <span className="text-slate-500">Min:</span>
                  <input
                    type="number"
                    min={-180}
                    max={180}
                    step={1}
                    value={zone.min_angle_deg}
                    onChange={(e) => handleUpdateZone(idx, 'min_angle_deg', Number(e.target.value))}
                    className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-slate-500">°</span>
                </div>

                {/* Max Angle */}
                <div className="flex items-center space-x-1">
                  <span className="text-slate-500">Max:</span>
                  <input
                    type="number"
                    min={-180}
                    max={180}
                    step={1}
                    value={zone.max_angle_deg}
                    onChange={(e) => handleUpdateZone(idx, 'max_angle_deg', Number(e.target.value))}
                    className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-slate-500">°</span>
                </div>

                {/* Alert Threshold dB */}
                <div className="flex items-center space-x-1">
                  <span className="text-slate-500">Alert:</span>
                  <input
                    type="number"
                    min={30}
                    max={120}
                    step={1}
                    value={zone.alert_threshold_db ?? 75}
                    onChange={(e) => handleUpdateZone(idx, 'alert_threshold_db', Number(e.target.value))}
                    className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-slate-500">dB</span>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => handleRemoveZone(idx)}
                  className="p-1.5 rounded text-rose-400 hover:text-rose-200 hover:bg-rose-950 transition-colors ml-auto"
                  title="Remove Zone"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleAddZone}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Spatial Sector</span>
          </button>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-950 border-t border-slate-800">
          <button
            onClick={() => setZones(initialZones)}
            className="flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Revert Changes</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Spatial Zones'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpatialZoneEditorModal;
