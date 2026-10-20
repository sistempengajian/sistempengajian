'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Check } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  group?: string;
}

interface CustomSelectProps {
  /** Current selected value(s) */
  value: string | string[];
  /** Available options */
  options: SelectOption[];
  /** Callback when selection changes */
  onChange: (value: string | string[]) => void;
  /** Placeholder text when nothing is selected */
  placeholder?: string;
  /** Allow selecting multiple options */
  multiple?: boolean;
  /** Show search/filter input */
  searchable?: boolean;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Label text shown above the select */
  label?: string;
  /** Additional className for the trigger button */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md';
}

// ── Constants ────────────────────────────────────────────────────────────────

const MOBILE_BREAKPOINT = 640; // sm breakpoint in Tailwind

// ── Helper Hooks ─────────────────────────────────────────────────────────────

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Pilih opsi...',
  multiple = false,
  searchable = false,
  searchPlaceholder = 'Cari...',
  disabled = false,
  label,
  className = '',
  size = 'md',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();

  const selectedValues = useMemo(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value]
  );

  const selectedLabels = useMemo(() => {
    if (selectedValues.length === 0) return '';
    if (selectedValues.length === 1) {
      return options.find((o) => o.value === selectedValues[0])?.label || selectedValues[0];
    }
    return `${selectedValues.length} dipilih`;
  }, [selectedValues, options]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q)
    );
  }, [options, search]);

  // Group options
  const groupedOptions = useMemo(() => {
    const groups: Record<string, SelectOption[]> = {};
    const ungrouped: SelectOption[] = [];
    for (const opt of filteredOptions) {
      if (opt.group) {
        if (!groups[opt.group]) groups[opt.group] = [];
        groups[opt.group].push(opt);
      } else {
        ungrouped.push(opt);
      }
    }
    return { groups, ungrouped };
  }, [filteredOptions]);

  const hasGroups = Object.keys(groupedOptions.groups).length > 0;

  const handleSelect = useCallback(
    (optValue: string) => {
      if (multiple) {
        const newValues = selectedValues.includes(optValue)
          ? selectedValues.filter((v) => v !== optValue)
          : [...selectedValues, optValue];
        onChange(newValues);
      } else {
        onChange(optValue);
        setIsOpen(false);
        setSearch('');
      }
    },
    [multiple, selectedValues, onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(multiple ? [] : '');
    },
    [multiple, onChange]
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearch('');
    triggerRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  // Lock body scroll when open on mobile
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, isMobile]);

  const sizeClasses = size === 'sm'
    ? 'text-xs py-1.5 px-2.5 min-h-[36px]'
    : 'text-[13px] py-2.5 px-3 min-h-[44px]';

  return (
    <div className={`relative ${className}`}>
      {/* Label */}
      {label && (
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between gap-2
          ${sizeClasses}
          bg-white border border-slate-200 rounded-xl
          text-left font-medium text-slate-700
          hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400
          transition-colors cursor-pointer
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span
          className={`truncate flex-1 ${
            selectedValues.length === 0 ? 'text-slate-400' : ''
          }`}
        >
          {selectedLabels || placeholder}
        </span>

        <span className="flex items-center gap-1 shrink-0">
          {/* Clear button */}
          {selectedValues.length > 0 && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-0.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Hapus pilihan"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {/* Dropdown / Bottom Sheet */}
      {isOpen && (
        isMobile ? (
          <BottomSheetPanel
            options={filteredOptions}
            groupedOptions={groupedOptions}
            hasGroups={hasGroups}
            selectedValues={selectedValues}
            onSelect={handleSelect}
            onClose={handleClose}
            searchable={searchable}
            searchPlaceholder={searchPlaceholder}
            search={search}
            setSearch={setSearch}
            placeholder={placeholder}
            multiple={multiple}
          />
        ) : (
          <DropdownPanel
            options={filteredOptions}
            groupedOptions={groupedOptions}
            hasGroups={hasGroups}
            selectedValues={selectedValues}
            onSelect={handleSelect}
            onClose={handleClose}
            searchable={searchable}
            searchPlaceholder={searchPlaceholder}
            search={search}
            setSearch={setSearch}
          />
        )
      )}
    </div>
  );
}

// ── Desktop Dropdown Panel ───────────────────────────────────────────────────

function DropdownPanel({
  options,
  groupedOptions,
  hasGroups,
  selectedValues,
  onSelect,
  onClose,
  searchable,
  searchPlaceholder,
  search,
  setSearch,
}: {
  options: SelectOption[];
  groupedOptions: { groups: Record<string, SelectOption[]>; ungrouped: SelectOption[] };
  hasGroups: boolean;
  selectedValues: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
  searchable: boolean;
  searchPlaceholder: string;
  search: string;
  setSearch: (s: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid immediate close
    requestAnimationFrame(() => {
      document.addEventListener('mousedown', handler);
    });
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Auto-focus search
  useEffect(() => {
    if (searchable) {
      searchRef.current?.focus();
    }
  }, [searchable]);

  return (
    <div
      ref={panelRef}
      className="
        absolute z-50 mt-1.5 w-full
        bg-white border border-slate-200
        rounded-xl shadow-dropdown
        animate-fade-in
        overflow-hidden
      "
      role="listbox"
    >
      {/* Search Input */}
      {searchable && (
        <div className="p-2 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="
                w-full pl-8 pr-3 py-2 text-xs
                bg-slate-50 border border-slate-200 rounded-lg
                focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400
                placeholder:text-slate-400
              "
            />
          </div>
        </div>
      )}

      {/* Options */}
      <div className="max-h-56 overflow-y-auto overscroll-contain py-1">
        {options.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-slate-400">
            Tidak ada opsi ditemukan
          </div>
        ) : hasGroups ? (
          <>
            {groupedOptions.ungrouped.map((opt) => (
              <OptionItem
                key={opt.value}
                option={opt}
                isSelected={selectedValues.includes(opt.value)}
                onSelect={onSelect}
              />
            ))}
            {Object.entries(groupedOptions.groups).map(([group, opts]) => (
              <div key={group}>
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {group}
                </div>
                {opts.map((opt) => (
                  <OptionItem
                    key={opt.value}
                    option={opt}
                    isSelected={selectedValues.includes(opt.value)}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            ))}
          </>
        ) : (
          options.map((opt) => (
            <OptionItem
              key={opt.value}
              option={opt}
              isSelected={selectedValues.includes(opt.value)}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Mobile Bottom Sheet Panel ────────────────────────────────────────────────

function BottomSheetPanel({
  options,
  groupedOptions,
  hasGroups,
  selectedValues,
  onSelect,
  onClose,
  searchable,
  searchPlaceholder,
  search,
  setSearch,
  placeholder,
  multiple,
}: {
  options: SelectOption[];
  groupedOptions: { groups: Record<string, SelectOption[]>; ungrouped: SelectOption[] };
  hasGroups: boolean;
  selectedValues: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
  searchable: boolean;
  searchPlaceholder: string;
  search: string;
  setSearch: (s: string) => void;
  placeholder: string;
  multiple: boolean;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
    if (searchable) {
      // Focus search after animation
      setTimeout(() => searchRef.current?.focus(), 350);
    }
  }, [searchable]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[9985]" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <div
        className={`
          absolute inset-0 bg-slate-900/50 backdrop-blur-sm
          transition-opacity duration-300
          ${isVisible ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={handleClose}
      />

      {/* Bottom Sheet */}
      <div
        className={`
          absolute bottom-0 left-0 right-0
          bg-white rounded-t-3xl
          shadow-modal
          max-h-[75vh]
          flex flex-col
          transition-transform duration-300 ease-out
          ${isVisible ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 shrink-0">
          <h3 className="text-sm font-bold text-slate-900">
            {placeholder}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        {searchable && (
          <div className="px-4 pb-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="
                  w-full pl-10 pr-4 py-3 text-sm
                  bg-slate-50 border border-slate-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400
                  placeholder:text-slate-400
                "
              />
            </div>
          </div>
        )}

        {/* Options */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-safe" role="listbox">
          {options.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-slate-400">
              Tidak ada opsi ditemukan
            </div>
          ) : hasGroups ? (
            <>
              {groupedOptions.ungrouped.map((opt) => (
                <OptionItem
                  key={opt.value}
                  option={opt}
                  isSelected={selectedValues.includes(opt.value)}
                  onSelect={onSelect}
                  mobile
                />
              ))}
              {Object.entries(groupedOptions.groups).map(([group, opts]) => (
                <div key={group}>
                  <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {group}
                  </div>
                  {opts.map((opt) => (
                    <OptionItem
                      key={opt.value}
                      option={opt}
                      isSelected={selectedValues.includes(opt.value)}
                      onSelect={onSelect}
                      mobile
                    />
                  ))}
                </div>
              ))}
            </>
          ) : (
            options.map((opt) => (
              <OptionItem
                key={opt.value}
                option={opt}
                isSelected={selectedValues.includes(opt.value)}
                onSelect={onSelect}
                mobile
              />
            ))
          )}
        </div>

        {/* Done button for multi-select */}
        {multiple && (
          <div className="p-4 border-t border-slate-100 shrink-0 pb-safe">
            <button
              type="button"
              onClick={handleClose}
              className="
                w-full py-3 rounded-xl
                bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800
                text-white text-sm font-bold
                transition-colors cursor-pointer
                min-h-[48px]
              "
            >
              Selesai ({selectedValues.length} dipilih)
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Option Item ──────────────────────────────────────────────────────────────

function OptionItem({
  option,
  isSelected,
  onSelect,
  mobile = false,
}: {
  option: SelectOption;
  isSelected: boolean;
  onSelect: (value: string) => void;
  mobile?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      disabled={option.disabled}
      onClick={() => !option.disabled && onSelect(option.value)}
      className={`
        w-full flex items-center gap-3 text-left
        ${mobile ? 'px-4 py-3 rounded-xl min-h-[48px]' : 'px-3 py-2 rounded-lg'}
        ${
          isSelected
            ? 'bg-emerald-50 text-emerald-800'
            : 'text-slate-700 hover:bg-slate-50'
        }
        ${option.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        transition-colors
      `}
    >
      {/* Optional icon */}
      {option.icon && <span className="shrink-0">{option.icon}</span>}

      {/* Label */}
      <span className="flex-1 min-w-0">
        <span className={`block ${mobile ? 'text-sm' : 'text-xs'} font-medium truncate`}>
          {option.label}
        </span>
        {option.description && (
          <span className={`block ${mobile ? 'text-xs' : 'text-[10px]'} text-slate-400 truncate mt-0.5`}>
            {option.description}
          </span>
        )}
      </span>

      {/* Check indicator */}
      {isSelected && (
        <Check
          className={`shrink-0 text-emerald-600 ${mobile ? 'w-5 h-5' : 'w-4 h-4'}`}
          strokeWidth={2.5}
        />
      )}
    </button>
  );
}
