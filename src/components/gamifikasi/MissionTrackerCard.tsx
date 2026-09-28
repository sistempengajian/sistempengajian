'use client';

import React, { useState } from 'react';
import {
  Clock,
  BookCheck,
  HeartHandshake,
  CalendarCheck,
  FileCheck,
  Flame,
  Award,
  Trophy,
  Home,
  CheckCircle2,
  Sparkles,
  Zap,
  Gift,
  Loader2,
  LucideIcon,
  ChevronRight,
  Info,
} from 'lucide-react';
import { GamificationMission, MissionCategory } from '@/app/(protected)/gamifikasi/types';
import { claimMissionReward } from '@/app/(protected)/gamifikasi/actions';

interface MissionTrackerCardProps {
  studentId: string;
  dailyMissions: GamificationMission[];
  weeklyMissions: GamificationMission[];
  milestoneMissions: GamificationMission[];
  onMissionClaimed?: (rewardXp: number) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Clock,
  BookCheck,
  HeartHandshake,
  CalendarCheck,
  FileCheck,
  Flame,
  Award,
  Trophy,
  Home,
};

export default function MissionTrackerCard({
  studentId,
  dailyMissions,
  weeklyMissions,
  milestoneMissions,
  onMissionClaimed,
}: MissionTrackerCardProps) {
  const [activeTab, setActiveTab] = useState<MissionCategory>('DAILY');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimedMissions, setClaimedMissions] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const missionsMap = {
    DAILY: dailyMissions,
    WEEKLY: weeklyMissions,
    MILESTONE: milestoneMissions,
  };

  const currentMissions = missionsMap[activeTab] || dailyMissions;

  // Handle claim action
  const handleClaim = async (mission: GamificationMission) => {
    if (claimingId) return;
    setClaimingId(mission.id);

    try {
      const res = await claimMissionReward(studentId, mission.code, mission.rewardXp);
      if (res.success) {
        setClaimedMissions((prev) => new Set(prev).add(mission.id));
        setToastMessage(res.message);
        if (onMissionClaimed) {
          onMissionClaimed(mission.rewardXp);
        }
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setToastMessage(res.message);
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setClaimingId(null);
    }
  };

  const countClaimable = (missions: GamificationMission[]) => {
    return missions.filter((m) => m.isCompleted && !m.isClaimed && !claimedMissions.has(m.id)).length;
  };

  const dailyClaimable = countClaimable(dailyMissions);
  const weeklyClaimable = countClaimable(weeklyMissions);
  const milestoneClaimable = countClaimable(milestoneMissions);

  return (
    <div className="rounded-3xl bg-white/90 border border-slate-200/80 shadow-sm p-4 sm:p-6 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-slate-900/95 text-white text-xs sm:text-sm font-semibold shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-md w-11/12">
          <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <span className="flex-1">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
              Misi & Tantangan Santri
            </h3>
            <p className="text-xs text-slate-500">
              Selesaikan target amal sholih dan kumpulkan XP penghargaan
            </p>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('DAILY')}
            className={`flex-1 sm:flex-initial relative px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'DAILY'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Harian</span>
            {dailyClaimable > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[10px] font-black">
                {dailyClaimable}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('WEEKLY')}
            className={`flex-1 sm:flex-initial relative px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'WEEKLY'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Pekanan</span>
            {weeklyClaimable > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[10px] font-black">
                {weeklyClaimable}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MILESTONE')}
            className={`flex-1 sm:flex-initial relative px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'MILESTONE'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Milestone</span>
            {milestoneClaimable > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[10px] font-black">
                {milestoneClaimable}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mission Cards Grid */}
      <div className="space-y-3">
        {currentMissions.map((mission) => {
          const IconComp = ICON_MAP[mission.iconName] || Trophy;
          const isAlreadyClaimed = mission.isClaimed || claimedMissions.has(mission.id);
          const isReadyToClaim = mission.isCompleted && !isAlreadyClaimed;
          const isProcessing = claimingId === mission.id;

          return (
            <div
              key={mission.id}
              className={`p-4 rounded-2xl border transition-all duration-200 ${
                isReadyToClaim
                  ? 'bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-amber-50/40 border-emerald-300 shadow-sm ring-1 ring-emerald-500/20'
                  : isAlreadyClaimed
                  ? 'bg-slate-50/70 border-slate-200/70 opacity-80'
                  : 'bg-white/80 border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Left: Icon & Description */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isReadyToClaim
                        ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                        : isAlreadyClaimed
                        ? 'bg-slate-200 text-slate-500'
                        : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                    }`}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                        {mission.title}
                      </h4>
                      {mission.expiresInLabel && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-medium">
                          {mission.expiresInLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      {mission.description}
                    </p>

                    {/* Progress Bar */}
                    <div className="mt-2.5 max-w-md">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Progress: {mission.currentProgress} / {mission.targetGoal}</span>
                        <span>{mission.progressPercent}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isReadyToClaim || isAlreadyClaimed
                              ? 'bg-emerald-500'
                              : 'bg-indigo-500'
                          }`}
                          style={{ width: `${mission.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Reward & Claim Button */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  {/* Reward XP Badge */}
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                    <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-600" />
                    <span>+{mission.rewardXp} XP</span>
                  </div>

                  {/* Action Button */}
                  {isReadyToClaim ? (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleClaim(mission)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>Klaim Hadiah</span>
                    </button>
                  ) : isAlreadyClaimed ? (
                    <div className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Telah Diklaim</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-400 text-[11px] font-medium">
                      <span>{mission.progressPercent}% Selesai</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
