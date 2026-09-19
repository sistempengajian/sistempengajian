'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronDown,
  Map,
  Landmark,
  Users,
  Pencil,
  GraduationCap,
} from 'lucide-react';
import { OrganizationTreeNode } from './types';

interface OrganizationTreeViewProps {
  tree: OrganizationTreeNode[];
  canEdit?: boolean;
  editableOrgIds?: string[];
}

const TYPE_CONFIG = {
  DAERAH: {
    label: 'Daerah',
    icon: Map,
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    iconColor: 'text-indigo-600',
    bgHover: 'hover:bg-indigo-50/60',
  },
  DESA: {
    label: 'Desa',
    icon: Landmark,
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconColor: 'text-emerald-600',
    bgHover: 'hover:bg-emerald-50/60',
  },
  KELOMPOK: {
    label: 'Kelompok',
    icon: Users,
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
    iconColor: 'text-sky-600',
    bgHover: 'hover:bg-sky-50/60',
  },
};

function TreeNodeItem({
  node,
  canEdit,
  editableOrgIds,
  level = 0,
}: {
  node: OrganizationTreeNode;
  canEdit?: boolean;
  editableOrgIds?: string[];
  level?: number;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const config = TYPE_CONFIG[node.type] || TYPE_CONFIG.KELOMPOK;
  const Icon = config.icon;
  const isNodeEditable = editableOrgIds ? editableOrgIds.includes(node.id) : canEdit;

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center justify-between gap-2 p-2.5 rounded-2xl border border-slate-200/60 bg-white ${config.bgHover} transition-all shadow-2xs group`}
        style={{ marginLeft: `${Math.min(level * 16, 48)}px` }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              {isOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <div className="w-6 h-6 shrink-0 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            </div>
          )}

          <div className={`w-7 h-7 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 ${config.iconColor}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black text-slate-900 truncate">
                {node.name}
              </span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${config.badgeBg}`}>
                {config.label}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md hidden sm:inline-block">
            {node.stats.users} Santri/User
          </span>

          {isNodeEditable && (
            <Link
              href={`/organisasi/${node.id}/edit`}
              className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shadow-2xs transition-all"
              title="Edit Wilayah"
            >
              <Pencil className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Render Sub-nodes */}
      {hasChildren && isOpen && (
        <div className="space-y-1 pl-2 border-l-2 border-slate-150 ml-3 sm:ml-4">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              canEdit={canEdit}
              editableOrgIds={editableOrgIds}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrganizationTreeView({
  tree,
  canEdit,
  editableOrgIds,
}: OrganizationTreeViewProps) {
  if (tree.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 rounded-3xl bg-white border border-slate-200/80">
        Belum ada tingkatan wilayah yang terdaftar.
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs sm:text-sm font-bold text-slate-800">
            Struktur Pohon Hierarki Wilayah
          </h3>
          <p className="text-[11px] text-slate-500">
            Relasi bertingkat: Daerah &rarr; Desa &rarr; Kelompok Binaan
          </p>
        </div>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
        {tree.map((node) => (
          <TreeNodeItem key={node.id} node={node} canEdit={canEdit} />
        ))}
      </div>
    </div>
  );
}
