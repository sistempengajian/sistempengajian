'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users,
  Plus,
  CheckCircle2,
  UserX,
  Loader2,
} from 'lucide-react';
import {
  UsersOverviewData,
  UserWithRelations,
  FormReferenceData,
} from './types';
import UserMetricsOverview from './UserMetricsOverview';
import UserFilterBar from './UserFilterBar';
import UserCard from './UserCard';
import UserTableView from './UserTableView';
import LinkParentChildModal from './LinkParentChildModal';
import DeleteUserModal from './DeleteUserModal';
import { fetchUsersOverviewAction } from '@/app/(protected)/users/actions';

interface UserManagementViewProps {
  initialData: UsersOverviewData;
  referenceData: FormReferenceData;
}

export default function UserManagementView({
  initialData,
  referenceData,
}: UserManagementViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Data States
  const [users, setUsers] = useState<UserWithRelations[]>(initialData.users);
  const [metrics, setMetrics] = useState(initialData.metrics);
  const [totalCount, setTotalCount] = useState<number>(
    initialData.pagination.total
  );
  const [page, setPage] = useState<number>(initialData.pagination.page);
  const [hasMore, setHasMore] = useState<boolean>(
    initialData.pagination.page < initialData.pagination.totalPages
  );

  // Loading States
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Filter States
  const [activeRoleTab, setActiveRoleTab] = useState<string>(
    searchParams.get('role') || 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    searchParams.get('search') || ''
  );
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>(
    searchParams.get('search') || ''
  );
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    searchParams.get('organizationId') || ''
  );
  const [selectedGenId, setSelectedGenId] = useState<string>(
    searchParams.get('generationId') || ''
  );
  const [selectedStatus, setSelectedStatus] = useState<string>(
    searchParams.get('status') || 'ALL'
  );
  const [viewMode, setViewMode] = useState<'CARD' | 'TABLE'>('CARD');

  // Modal States
  const [selectedStudentForLink, setSelectedStudentForLink] =
    useState<UserWithRelations | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  const [selectedUserForDelete, setSelectedUserForDelete] =
    useState<UserWithRelations | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { canCreateUser, canEditUser, canDeleteUser, manageableRoles } =
    initialData.currentUserPermissions;

  const isInitialMount = useRef(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch data ketika filter / search berubah
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    let isSubscribed = true;

    async function applyFilters() {
      setIsLoadingInitial(true);
      try {
        const res = await fetchUsersOverviewAction({
          page: 1,
          limit: 20,
          role: activeRoleTab,
          search: debouncedSearchQuery,
          organizationId: selectedOrgId,
          generationId: selectedGenId,
          status: selectedStatus,
        });

        if (isSubscribed && res.success && res.data) {
          setUsers(res.data.users);
          setPage(1);
          setHasMore(res.data.pagination.page < res.data.pagination.totalPages);
          setTotalCount(res.data.pagination.total);
          if (res.data.metrics) {
            setMetrics(res.data.metrics);
          }
        }
      } catch (err) {
        console.error('Failed to apply user filters:', err);
      } finally {
        if (isSubscribed) {
          setIsLoadingInitial(false);
        }
      }
    }

    applyFilters();

    return () => {
      isSubscribed = false;
    };
  }, [
    activeRoleTab,
    debouncedSearchQuery,
    selectedOrgId,
    selectedGenId,
    selectedStatus,
  ]);

  // Load More Users (Infinite Scroll)
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || isLoadingInitial || !hasMore) return;

    setIsLoadingMore(true);
    const nextPage = page + 1;

    try {
      const res = await fetchUsersOverviewAction({
        page: nextPage,
        limit: 20,
        role: activeRoleTab,
        search: debouncedSearchQuery,
        organizationId: selectedOrgId,
        generationId: selectedGenId,
        status: selectedStatus,
      });

      if (res.success && res.data) {
        setUsers((prev) => {
          const existingIds = new Set(prev.map((u) => u.id));
          const uniqueNewUsers = res.data!.users.filter(
            (u) => !existingIds.has(u.id)
          );
          return [...prev, ...uniqueNewUsers];
        });
        setPage(nextPage);
        setHasMore(res.data.pagination.page < res.data.pagination.totalPages);
        setTotalCount(res.data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to load more users:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    isLoadingInitial,
    hasMore,
    page,
    activeRoleTab,
    debouncedSearchQuery,
    selectedOrgId,
    selectedGenId,
    selectedStatus,
  ]);

  // IntersectionObserver untuk auto-load saat scroll mendekati bawah
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoadingMore && !isLoadingInitial) {
          handleLoadMore();
        }
      },
      {
        root: null,
        rootMargin: '300px',
        threshold: 0.05,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [handleLoadMore, hasMore, isLoadingMore, isLoadingInitial]);

  const handleOpenLinkParent = (student: UserWithRelations) => {
    setSelectedStudentForLink(student);
    setIsLinkModalOpen(true);
  };

  const handleOpenDelete = (user: UserWithRelations) => {
    setSelectedUserForDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSuccess = (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setTotalCount((prev) => Math.max(0, prev - 1));
    showToast('Aksi pengelolaan akun pengguna berhasil dilakukan.');
    router.refresh();
  };

  const handleLinkSuccess = () => {
    showToast('Relasi orang tua dan santri berhasil diperbarui.');
    router.refresh();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-18 right-4 sm:right-8 z-50 rounded-2xl bg-emerald-700 text-white px-4 py-3 shadow-xl border border-emerald-500/50 flex items-center gap-2.5 text-xs font-semibold animate-slide-down">
          <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Halaman */}
      <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-slate-200/60 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-2xs shrink-0">
                <Users className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                Kelola Pengguna &amp; Hak Akses
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Manajemen akun pengguna sistem pengajian: santri binaan, dewan pengajar, wali kelas, pengurus wilayah, dan relasi orang tua.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {canCreateUser && (
              <Link
                href="/users/tambah"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Tambah Pengguna</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Ringkasan Metrik Pengguna */}
      <UserMetricsOverview metrics={metrics} />

      {/* Toolbar Kontrol: Filter Tabs, Search Bar, & View Mode Switcher */}
      <UserFilterBar
        activeRoleTab={activeRoleTab}
        onRoleTabChange={setActiveRoleTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedOrgId={selectedOrgId}
        onOrgChange={setSelectedOrgId}
        selectedGenId={selectedGenId}
        onGenChange={setSelectedGenId}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        organizations={referenceData.organizations}
        generations={referenceData.generations}
        totalResults={totalCount}
        manageableRoles={manageableRoles}
      />

      {/* Main Content: Card View OR Table View */}
      {isLoadingInitial ? (
        viewMode === 'TABLE' ? (
          <div className="rounded-3xl bg-white border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-center gap-2.5 py-12 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span className="text-xs font-semibold">Memuat data pengguna...</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs animate-pulse space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-200" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-200 rounded-md w-1/2" />
                    <div className="h-3 bg-slate-100 rounded-md w-1/3" />
                  </div>
                </div>
                <div className="h-3 bg-slate-100 rounded-md w-3/4" />
              </div>
            ))}
          </div>
        )
      ) : viewMode === 'TABLE' ? (
        users.length > 0 ? (
          <UserTableView
            users={users}
            canEdit={canEditUser}
            canDelete={canDeleteUser}
            onLinkParent={handleOpenLinkParent}
            onDelete={handleOpenDelete}
          />
        ) : (
          <div className="rounded-3xl bg-white border border-slate-200/80 p-12 text-center shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <UserX className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              Tidak ada data pengguna yang sesuai
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {searchQuery || selectedOrgId || selectedGenId || selectedStatus !== 'ALL'
                ? 'Coba sesuaikan kata kunci pencarian atau reset filter yang sedang aktif.'
                : 'Belum ada data pengguna untuk kategori ini.'}
            </p>
          </div>
        )
      ) : (
        <>
          {users.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {users.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  canEdit={canEditUser}
                  canDelete={canDeleteUser}
                  onLinkParent={handleOpenLinkParent}
                  onDelete={handleOpenDelete}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl bg-white border border-slate-200/80 p-12 text-center shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <UserX className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Tidak ada data pengguna yang sesuai
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchQuery || selectedOrgId || selectedGenId || selectedStatus !== 'ALL'
                  ? 'Coba sesuaikan kata kunci pencarian atau reset filter yang sedang aktif.'
                  : 'Belum ada data pengguna untuk kategori ini.'}
              </p>
            </div>
          )}
        </>
      )}

      {/* Sentinel Element & Loading More Indicator for Infinite Scroll */}
      <div ref={sentinelRef} className="w-full py-2">
        {isLoadingMore && (
          <div className="flex items-center justify-center gap-2.5 py-4 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            <span className="text-xs font-semibold">
              Memuat data pengguna selanjutnya...
            </span>
          </div>
        )}

        {!hasMore && !isLoadingInitial && users.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span>
              Menampilkan seluruh {users.length} dari {totalCount} akun pengguna
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          </div>
        )}
      </div>

      {/* Modal Tautkan Orang Tua */}
      <LinkParentChildModal
        isOpen={isLinkModalOpen}
        onClose={() => {
          setIsLinkModalOpen(false);
          setSelectedStudentForLink(null);
        }}
        student={selectedStudentForLink}
        onSuccess={handleLinkSuccess}
      />

      {/* Modal Hapus / Nonaktifkan User */}
      <DeleteUserModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedUserForDelete(null);
        }}
        user={selectedUserForDelete}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}

