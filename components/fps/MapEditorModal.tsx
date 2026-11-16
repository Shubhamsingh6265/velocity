'use client';

import React from 'react';
import { Eraser, Play, Trash2, X } from 'lucide-react';
import { cloneCustomMap } from '@/lib/fps/maps';
import { BlockMaterialType, MapBlock, MapData } from '@/lib/fps/types';

interface MapEditorModalProps {
  initialBlocks: MapBlock[];
  onClose: () => void;
  onPlayCustomMap: (blocks: MapBlock[], map: MapData) => void;
}

const GRID_CELLS = 16;
const CELL_SIZE = 3;

const MATERIALS: Array<{ id: BlockMaterialType; label: string; color: string }> = [
  { id: 'concrete', label: 'Concrete', color: '#64707d' },
  { id: 'steel', label: 'Steel', color: '#475569' },
  { id: 'crate', label: 'Crate', color: '#a47148' },
  { id: 'hazard', label: 'Hazard', color: '#e59500' },
  { id: 'container_blue', label: 'Blue Cargo', color: '#275d94' },
  { id: 'container_red', label: 'Red Cargo', color: '#b8332a' },
];

export default function MapEditorModal({
  initialBlocks,
  onClose,
  onPlayCustomMap,
}: MapEditorModalProps) {
  const [blocks, setBlocks] = React.useState<MapBlock[]>(initialBlocks);
  const [brushMat, setBrushMat] = React.useState<BlockMaterialType>('crate');
  const [brushHeight, setBrushHeight] = React.useState<number>(2.0);
  const [eraseMode, setEraseMode] = React.useState(false);

  const toggleCell = (gx: number, gz: number) => {
    const worldX = (gx - GRID_CELLS / 2 + 0.5) * CELL_SIZE;
    const worldZ = (gz - GRID_CELLS / 2 + 0.5) * CELL_SIZE;
    if (Math.abs(worldX) >= 18 && Math.abs(worldZ) >= 18) return;

    const existingIdx = blocks.findIndex(
      (b) => Math.abs(b.x - worldX) < 0.5 && Math.abs(b.z - worldZ) < 0.5,
    );

    if (eraseMode || existingIdx >= 0) {
      if (existingIdx >= 0) {
        setBlocks((prev) => prev.filter((_, i) => i !== existingIdx));
      }
      return;
    }

    const newBlock: MapBlock = {
      id: `custom_${gx}_${gz}_${Date.now()}`,
      x: worldX,
      y: brushHeight / 2,
      z: worldZ,
      w: CELL_SIZE,
      h: brushHeight,
      d: CELL_SIZE,
      material: brushMat,
    };
    setBlocks((prev) => [...prev, newBlock]);
  };

  return (
    <div className="fixed inset-0 z-30 bg-[#070B12]/90 flex items-center justify-center p-4">
      <div className="w-full max-w-[680px] bg-[#0F1623] border border-white/15 rounded-xl p-5 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-xl text-white">Arena Map Builder</h2>
            <p className="text-xs text-slate-400">
              Click grid cells to place or remove tactical cover blocks (48m x 48m arena).
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Map Builder"
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-[#090D16] border border-white/12 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {MATERIALS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setEraseMode(false);
                  setBrushMat(m.id);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 cursor-pointer ${
                  !eraseMode && brushMat === m.id
                    ? 'border-amber-500 bg-amber-500/15 text-white'
                    : 'border-white/10 bg-[#090D16] text-slate-300'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: m.color }} />
                {m.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setEraseMode((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1 cursor-pointer ${
                eraseMode
                  ? 'border-red-500 bg-red-500/15 text-red-300'
                  : 'border-white/10 bg-[#090D16] text-slate-300'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              Erase
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {[1.5, 2.5, 4.0].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setBrushHeight(h)}
                className={`px-2.5 py-1 rounded text-xs font-mono border cursor-pointer ${
                  brushHeight === h
                    ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                    : 'border-white/10 bg-[#090D16] text-slate-400'
                }`}
              >
                {h}m
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto grid grid-cols-16 gap-1 bg-[#090D16] p-2.5 rounded-lg border border-white/12">
          {Array.from({ length: GRID_CELLS * GRID_CELLS }).map((_, idx) => {
            const gx = idx % GRID_CELLS;
            const gz = Math.floor(idx / GRID_CELLS);
            const worldX = (gx - GRID_CELLS / 2 + 0.5) * CELL_SIZE;
            const worldZ = (gz - GRID_CELLS / 2 + 0.5) * CELL_SIZE;
            const isSpawnZone = Math.abs(worldX) >= 18 && Math.abs(worldZ) >= 18;
            const existing = blocks.find(
              (b) => Math.abs(b.x - worldX) < 0.5 && Math.abs(b.z - worldZ) < 0.5,
            );
            const matColor = existing
              ? MATERIALS.find((m) => m.id === existing.material)?.color || '#64707d'
              : undefined;

            return (
              <button
                key={`${gx}_${gz}`}
                type="button"
                aria-label={`Grid cell ${gx},${gz}`}
                onClick={() => toggleCell(gx, gz)}
                disabled={isSpawnZone}
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-sm border transition-colors ${
                  isSpawnZone
                    ? 'bg-emerald-950/50 border-emerald-500/30 cursor-not-allowed'
                    : 'border-white/10 hover:border-amber-400 cursor-pointer'
                }`}
                style={matColor ? { backgroundColor: matColor } : undefined}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setBlocks([])}
            className="px-3 py-2 rounded-lg bg-[#090D16] border border-white/12 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear ({blocks.length} blocks)
          </button>
          <button
            type="button"
            onClick={() => onPlayCustomMap(blocks, cloneCustomMap(blocks, 'Custom Arena'))}
            className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            Play Custom Map
          </button>
        </div>
      </div>
    </div>
  );
}
