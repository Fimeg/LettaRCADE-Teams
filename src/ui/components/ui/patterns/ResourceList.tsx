/**
 * ResourceList Component - Grid layout for resource cards with search, sort, pagination
 *
 * Features:
 * - Grid layout for resource cards (responsive 1-4 columns)
 * - Search/filter bar integration
 * - Sort dropdown
 * - Empty state
 * - Loading skeleton
 * - Pagination or infinite scroll
 * - Selection mode (multi-select)
 *
 * Uses Card business component + Input primitive + Toolbar layout.
 * Similar to AgentsBrowser grid but generic for any resource type.
 */

import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { cva } from 'class-variance-authority';
import {
  ChevronDown,
  Check,
  Square,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Plus,
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { Card, CardContent } from '../composites/Card';
import { Input } from '../primitives/Input';
import { Button } from '../primitives/Button';

// ============================================================================
// 1. TYPE DEFINITIONS
// ============================================================================

interface ResourceListProps<T> {
  /** Resources to display */
  resources: T[];
  /** Render function for each resource card */
  renderItem: (resource: T, context: ItemContext) => React.ReactNode;
  /** Unique key extractor */
  keyExtractor: (resource: T) => string;
  /** Loading state */
  loading?: boolean;
  /** Enable search */
  searchable?: boolean;
  /** Enable sorting */
  sortable?: boolean;
  /** Sort options */
  sortOptions?: { value: string; label: string }[];
  /** Current sort value */
  sortValue?: string;
  /** Sort change callback */
  onSortChange?: (value: string) => void;
  /** Enable selection */
  selectable?: boolean;
  /** Selected keys (controlled) */
  selectedKeys?: string[];
  /** Selection change callback */
  onSelectionChange?: (keys: string[]) => void;
  /** Pagination mode */
  paginationMode?: 'pagination' | 'loadMore' | 'none';
  /** Current page (pagination mode) */
  page?: number;
  /** Total pages (pagination mode) */
  totalPages?: number;
  /** Page change callback */
  onPageChange?: (page: number) => void;
  /** Has more items (loadMore mode) */
  hasMore?: boolean;
  /** Loading more state (loadMore mode) */
  loadingMore?: boolean;
  /** Load more callback */
  onLoadMore?: () => void;
  /** Empty state title */
  emptyTitle?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state action */
  emptyAction?: { label: string; onClick: () => void };
  /** Skeleton count during loading */
  skeletonCount?: number;
  /** Custom search function */
  searchFn?: (resource: T, query: string) => boolean;
  /** Additional className */
  className?: string;
  /** List size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Number of columns in grid (1-4 or 'auto') */
  columns?: 1 | 2 | 3 | 4 | 'auto';
}

interface ItemContext {
  /** Whether item is selected */
  isSelected: boolean;
  /** Toggle selection handler */
  onToggleSelect: () => void;
  /** Index in the list */
  index: number;
}

// ============================================================================
// 2. VARIANT CONFIGURATION (cva)
// ============================================================================

const resourceListVariants = cva('flex flex-col gap-4', {
  variants: {
    size: {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const gridVariants = cva('grid gap-4', {
  variants: {
    columns: {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
      auto: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
    },
  },
  defaultVariants: {
    columns: 'auto',
  },
});

// ============================================================================
// 3. HELPER COMPONENTS
// ============================================================================

/**
 * Skeleton card for loading state
 */
function CardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-ink-200" />
          <div className="flex-1 space-y-1">
            <div className="h-4 w-3/4 rounded bg-ink-200" />
            <div className="h-3 w-1/2 rounded bg-ink-200" />
          </div>
        </div>
        <div className="h-8 rounded bg-ink-200" />
        <div className="flex justify-between">
          <div className="h-3 w-16 rounded bg-ink-200" />
          <div className="h-3 w-12 rounded bg-ink-200" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Empty state component
 */
function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-surface-secondary p-4 mb-4">
        <Inbox className="h-8 w-8 text-ink-400" />
      </div>
      <h3 className="text-base font-medium text-ink-900 mb-1">{title}</h3>
      <p className="text-sm text-ink-500 max-w-sm mb-4">{message}</p>
      {action && (
        <Button onClick={action.onClick} leftIcon={Plus}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

/**
 * Selection checkbox component
 */
function SelectionCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className="flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900 transition-colors"
      aria-label={label}
    >
      {checked ? (
        <CheckSquare className="h-4 w-4 text-accent" />
      ) : (
        <Square className="h-4 w-4 text-ink-400" />
      )}
    </button>
  );
}

// ============================================================================
// 4. MAIN COMPONENT
// ============================================================================

function ResourceList<T>({
  resources,
  renderItem,
  keyExtractor,
  loading = false,
  searchable = false,
  sortable = false,
  sortOptions = [],
  sortValue,
  onSortChange,
  selectable = false,
  selectedKeys: controlledSelectedKeys,
  onSelectionChange,
  paginationMode = 'none',
  page = 1,
  totalPages = 1,
  onPageChange,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  emptyTitle = 'No items found',
  emptyMessage = 'Get started by creating your first item.',
  emptyAction,
  skeletonCount = 8,
  searchFn,
  className,
  size,
  columns,
}: ResourceListProps<T>) {
  // Internal state
  const [searchQuery, setSearchQuery] = useState('');
  const [internalSelectedKeys, setInternalSelectedKeys] = useState<Set<string>>(
    new Set()
  );
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Controlled or uncontrolled selection
  const isControlledSelection = controlledSelectedKeys !== undefined;
  const selectedKeys = isControlledSelection
    ? new Set(controlledSelectedKeys)
    : internalSelectedKeys;

  // Default search function
  const defaultSearchFn = useCallback((resource: T, query: string): boolean => {
    const searchStr = JSON.stringify(resource).toLowerCase();
    return searchStr.includes(query.toLowerCase());
  }, []);

  const activeSearchFn = searchFn || defaultSearchFn;

  // Filter resources based on search
  const filteredResources = useMemo(() => {
    if (!searchable || !searchQuery) return resources;
    return resources.filter((r) => activeSearchFn(r, searchQuery));
  }, [resources, searchable, searchQuery, activeSearchFn]);

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    const allIds = filteredResources.map(keyExtractor);
    const allSelected = allIds.every((id) => selectedKeys.has(id));

    let newSelected: Set<string>;
    if (allSelected) {
      newSelected = new Set(
        Array.from(selectedKeys).filter((k) => !allIds.includes(k))
      );
    } else {
      newSelected = new Set([...selectedKeys, ...allIds]);
    }

    if (isControlledSelection) {
      onSelectionChange?.(Array.from(newSelected));
    } else {
      setInternalSelectedKeys(newSelected);
    }
  }, [
    filteredResources,
    keyExtractor,
    selectedKeys,
    isControlledSelection,
    onSelectionChange,
  ]);

  const handleSelectItem = useCallback(
    (resource: T) => {
      const id = keyExtractor(resource);
      const newSelected = new Set(selectedKeys);

      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }

      if (isControlledSelection) {
        onSelectionChange?.(Array.from(newSelected));
      } else {
        setInternalSelectedKeys(newSelected);
      }
    },
    [keyExtractor, selectedKeys, isControlledSelection, onSelectionChange]
  );

  // Calculate selection state
  const allSelected =
    filteredResources.length > 0 &&
    filteredResources.every((r) => selectedKeys.has(keyExtractor(r)));

  // Sort dropdown ref for click outside
  const sortDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(e.target as Node)
      ) {
        setShowSortDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <div className={cn(resourceListVariants({ size }), className)}>
        <div className={cn(gridVariants({ columns }))}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (filteredResources.length === 0) {
    return (
      <div className={cn(resourceListVariants({ size }), className)}>
        {searchable && (
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-md">
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}
        <EmptyState
          title={searchQuery ? 'No results found' : emptyTitle}
          message={
            searchQuery
              ? `No items match "${searchQuery}". Try a different search.`
              : emptyMessage
          }
          action={
            searchQuery
              ? { label: 'Clear search', onClick: () => setSearchQuery('') }
              : emptyAction
          }
        />
      </div>
    );
  }

  return (
    <div className={cn(resourceListVariants({ size }), className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {selectable && (
            <SelectionCheckbox
              checked={allSelected}
              onChange={handleSelectAll}
              label={allSelected ? 'Deselect all' : 'Select all'}
            />
          )}
          {selectable && selectedKeys.size > 0 && (
            <span className="text-sm text-ink-600">
              {selectedKeys.size} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {searchable && (
            <div className="w-64">
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {sortable && sortOptions.length > 0 && (
            <div className="relative" ref={sortDropdownRef}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                rightIcon={ChevronDown}
              >
                {sortValue
                  ? sortOptions.find((o) => o.value === sortValue)?.label ||
                    'Sort'
                  : 'Sort'}
              </Button>

              {showSortDropdown && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-ink-900/10 rounded-lg shadow-lg py-1 z-50">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      className={cn(
                        'w-full px-4 py-2 text-left text-sm hover:bg-surface-tertiary flex items-center justify-between',
                        sortValue === option.value && 'bg-accent/10 text-accent'
                      )}
                      onClick={() => {
                        onSortChange?.(option.value);
                        setShowSortDropdown(false);
                      }}
                    >
                      {option.label}
                      {sortValue === option.value && (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className={cn(gridVariants({ columns }))}>
        {filteredResources.map((resource, index) => {
          const id = keyExtractor(resource);
          const isSelected = selectedKeys.has(id);

          return (
            <div key={id} className="relative group">
              {selectable && (
                <div className="absolute top-2 left-2 z-10">
                  <SelectionCheckbox
                    checked={isSelected}
                    onChange={() => handleSelectItem(resource)}
                    label={isSelected ? 'Deselect' : 'Select'}
                  />
                </div>
              )}
              {renderItem(resource, {
                isSelected,
                onToggleSelect: () => handleSelectItem(resource),
                index,
              })}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {paginationMode === 'pagination' && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange?.(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-ink-600 px-2">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange?.(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Load More */}
      {paginationMode === 'loadMore' && (hasMore || loadingMore) && (
        <div className="flex justify-center pt-4">
          <Button
            variant="secondary"
            onClick={onLoadMore}
            disabled={!hasMore || loadingMore}
            isLoading={loadingMore}
          >
            {loadingMore ? 'Loading...' : hasMore ? 'Load more' : 'No more items'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 5. EXPORTS
// ============================================================================

export { ResourceList, resourceListVariants, gridVariants };
export type { ResourceListProps, ItemContext };
export default ResourceList;
