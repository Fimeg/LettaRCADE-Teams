/**
 * DataTable Component - Advanced data grid with sorting, filtering, pagination, and selection
 *
 * A comprehensive table component featuring:
 * - Sortable columns (click header to sort, shows sort indicator)
 * - Filterable rows with search input
 * - Pagination support (page size selector, prev/next buttons)
 * - Row selection with checkboxes (select all, individual rows)
 * - Empty state when no data
 * - Loading skeleton state
 * - Sticky header
 * - Column resizing support
 */

import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { cva } from 'class-variance-authority';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { Input } from '../primitives/Input';
import { Button } from '../primitives/Button';

// ============================================================================
// 1. TYPE DEFINITIONS
// ============================================================================

/**
 * Column definition for DataTable
 * @template T - The type of data row
 */
interface DataTableColumn<T> {
  /** Unique key for the column */
  key: string;
  /** Header content (string or React node) */
  header: React.ReactNode;
  /** Optional width (CSS value like '100px', '20%', etc.) */
  width?: string;
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Custom render function for cell content */
  render?: (row: T) => React.ReactNode;
  /** Accessor function to get the value for sorting/filtering (defaults to row[key]) */
  accessor?: (row: T) => unknown;
  /** Text alignment for the column */
  align?: 'left' | 'center' | 'right';
}

/**
 * Props for the DataTable component
 * @template T - The type of data row
 */
interface DataTableProps<T> {
  /** Data array to display */
  data: T[];
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Function to extract unique key from each row */
  keyExtractor: (row: T) => string;
  /** Loading state - shows skeleton when true */
  loading?: boolean;
  /** Enable search filtering */
  searchable?: boolean;
  /** Enable pagination */
  paginated?: boolean;
  /** Default page size (defaults to 10) */
  pageSize?: number;
  /** Available page size options */
  pageSizeOptions?: number[];
  /** Enable row selection */
  selectable?: boolean;
  /** Currently selected row keys (controlled) */
  selectedKeys?: string[];
  /** Callback when selection changes */
  onSelectionChange?: (keys: string[]) => void;
  /** Message to show when data is empty */
  emptyMessage?: string;
  /** Custom className for the container */
  className?: string;
  /** Callback when a row is clicked */
  onRowClick?: (row: T) => void;
  /** Custom filter function (replaces default search) */
  filterFn?: (row: T, query: string) => boolean;
  /** Initial sort column */
  initialSortColumn?: string;
  /** Initial sort direction */
  initialSortDirection?: 'asc' | 'desc';
  /** Table size variant */
  size?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// 2. VARIANT CONFIGURATION (cva)
// ============================================================================

const tableContainerVariants = cva(
  'w-full rounded-xl border border-ink-900/10 bg-surface overflow-hidden flex flex-col',
  {
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
  }
);

const tableHeaderCellVariants = cva(
  'px-4 py-3 text-left font-medium text-ink-700 bg-surface-secondary border-b border-ink-900/10 whitespace-nowrap',
  {
    variants: {
      sortable: {
        true: 'cursor-pointer hover:bg-ink-900/5 select-none',
        false: '',
      },
      align: {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
      },
      isSorted: {
        true: 'text-accent',
        false: '',
      },
    },
    defaultVariants: {
      sortable: false,
      align: 'left',
      isSorted: false,
    },
  }
);

const tableCellVariants = cva(
  'px-4 py-3 border-b border-ink-900/5 text-ink-900 whitespace-nowrap',
  {
    variants: {
      align: {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
      },
      isSelected: {
        true: 'bg-accent-subtle',
        false: '',
      },
      clickable: {
        true: 'cursor-pointer',
        false: '',
      },
    },
    defaultVariants: {
      align: 'left',
      isSelected: false,
      clickable: false,
    },
  }
);

const tableRowVariants = cva(
  'transition-colors',
  {
    variants: {
      clickable: {
        true: 'cursor-pointer hover:bg-ink-900/5',
        false: '',
      },
      selected: {
        true: 'bg-accent-subtle hover:bg-accent-subtle',
        false: '',
      },
    },
    defaultVariants: {
      clickable: false,
      selected: false,
    },
  }
);

// ============================================================================
// 3. HELPER COMPONENTS
// ============================================================================

/**
 * Checkbox component for row selection
 */
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  indeterminate?: boolean;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate, ...props }, ref) => {
    const internalRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => internalRef.current!, []);

    React.useEffect(() => {
      if (internalRef.current) {
        internalRef.current.indeterminate = indeterminate || false;
      }
    }, [indeterminate]);

    return (
      <div className="relative flex items-center justify-center">
        <input
          type="checkbox"
          ref={internalRef}
          className={cn(
            'peer h-4 w-4 cursor-pointer appearance-none rounded border border-ink-400',
            'checked:border-accent checked:bg-accent',
            'indeterminate:border-accent indeterminate:bg-accent',
            'focus:outline-none focus:ring-2 focus:ring-accent/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          {...props}
        />
        <svg
          className="pointer-events-none absolute hidden h-3 w-3 text-white peer-checked:block peer-indeterminate:block"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {indeterminate ? (
            <line x1="5" y1="12" x2="19" y2="12" />
          ) : (
            <polyline points="20 6 9 17 4 12" />
          )}
        </svg>
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';

/**
 * Skeleton loader for table rows
 */
function TableSkeleton({
  columns,
  rows = 5,
  selectable,
}: {
  columns: number;
  rows?: number;
  selectable?: boolean;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr key={rowIdx} className="animate-pulse">
          {selectable && (
            <td className="px-4 py-3 border-b border-ink-900/5">
              <div className="h-4 w-4 rounded bg-ink-200" />
            </td>
          )}
          {Array.from({ length: columns }).map((_, colIdx) => (
            <td key={colIdx} className="px-4 py-3 border-b border-ink-900/5">
              <div
                className={cn(
                  'h-4 rounded bg-ink-200',
                  colIdx === 0 ? 'w-3/4' : colIdx === columns - 1 ? 'w-1/2' : 'w-full'
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ============================================================================
// 4. MAIN COMPONENT
// ============================================================================

function DataTable<T>({
  data,
  columns,
  keyExtractor,
  loading = false,
  searchable = false,
  paginated = false,
  pageSize: defaultPageSize = 10,
  pageSizeOptions = [5, 10, 25, 50, 100],
  selectable = false,
  selectedKeys: controlledSelectedKeys,
  onSelectionChange,
  emptyMessage = 'No data available',
  className,
  onRowClick,
  filterFn,
  initialSortColumn,
  initialSortDirection = 'asc',
  size,
}: DataTableProps<T>) {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(initialSortColumn || null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [internalSelectedKeys, setInternalSelectedKeys] = useState<Set<string>>(new Set());

  // Determine if we're in controlled selection mode
  const isControlledSelection = controlledSelectedKeys !== undefined;
  const selectedKeys = isControlledSelection
    ? new Set(controlledSelectedKeys)
    : internalSelectedKeys;

  // Default filter function (searches all string values in row)
  const defaultFilterFn = useCallback(
    (row: T, query: string): boolean => {
      const searchFields = columns
        .map((col) => {
          const value = col.accessor ? col.accessor(row) : (row as Record<string, unknown>)[col.key];
          return value != null ? String(value).toLowerCase() : '';
        })
        .join(' ');
      return searchFields.includes(query.toLowerCase());
    },
    [columns]
  );

  const activeFilterFn = filterFn || defaultFilterFn;

  // Process data: filter, sort, paginate
  const processedData = useMemo(() => {
    let result = [...data];

    // Filter
    if (searchable && searchQuery) {
      result = result.filter((row) => activeFilterFn(row, searchQuery));
    }

    // Sort
    if (sortColumn) {
      const column = columns.find((c) => c.key === sortColumn);
      if (column) {
        result.sort((a, b) => {
          const aVal = column.accessor
            ? column.accessor(a)
            : (a as Record<string, unknown>)[column.key];
          const bVal = column.accessor
            ? column.accessor(b)
            : (b as Record<string, unknown>)[column.key];

          if (aVal === bVal) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;

          const comparison = String(aVal).localeCompare(String(bVal), undefined, {
            numeric: true,
            sensitivity: 'base',
          });
          return sortDirection === 'asc' ? comparison : -comparison;
        });
      }
    }

    return result;
  }, [data, searchable, searchQuery, sortColumn, sortDirection, columns, activeFilterFn]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize);
  const paginatedData = useMemo(() => {
    if (!paginated) return processedData;
    const start = (currentPage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, paginated, currentPage, pageSize]);

  // Handlers
  const handleSort = useCallback(
    (columnKey: string) => {
      const column = columns.find((c) => c.key === columnKey);
      if (!column?.sortable) return;

      if (sortColumn === columnKey) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortColumn(columnKey);
        setSortDirection('asc');
      }
      setCurrentPage(1);
    },
    [sortColumn, columns]
  );

  const handleSelectAll = useCallback(() => {
    const visibleKeys = paginatedData.map(keyExtractor);
    const allSelected = visibleKeys.every((key) => selectedKeys.has(key));

    let newSelectedKeys: Set<string>;
    if (allSelected) {
      newSelectedKeys = new Set(
        Array.from(selectedKeys).filter((k) => !visibleKeys.includes(k))
      );
    } else {
      newSelectedKeys = new Set([...selectedKeys, ...visibleKeys]);
    }

    if (isControlledSelection) {
      onSelectionChange?.(Array.from(newSelectedKeys));
    } else {
      setInternalSelectedKeys(newSelectedKeys);
    }
  }, [paginatedData, keyExtractor, selectedKeys, isControlledSelection, onSelectionChange]);

  const handleSelectRow = useCallback(
    (row: T) => {
      const key = keyExtractor(row);
      const newSelectedKeys = new Set(selectedKeys);

      if (newSelectedKeys.has(key)) {
        newSelectedKeys.delete(key);
      } else {
        newSelectedKeys.add(key);
      }

      if (isControlledSelection) {
        onSelectionChange?.(Array.from(newSelectedKeys));
      } else {
        setInternalSelectedKeys(newSelectedKeys);
      }
    },
    [keyExtractor, selectedKeys, isControlledSelection, onSelectionChange]
  );

  const handleRowClick = useCallback(
    (row: T) => {
      if (onRowClick) {
        onRowClick(row);
      }
    },
    [onRowClick]
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  // Determine if all visible rows are selected
  const visibleKeys = paginatedData.map(keyExtractor);
  const allSelected =
    visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeys.has(key));
  const someSelected =
    visibleKeys.some((key) => selectedKeys.has(key)) && !allSelected;

  // Render
  return (
    <div className={cn(tableContainerVariants({ size }), className)}>
      {/* Toolbar */}
      {(searchable || (selectable && selectedKeys.size > 0)) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-900/10 bg-surface-secondary">
          {searchable && (
            <div className="flex-1 max-w-sm">
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
          {selectable && selectedKeys.size > 0 && (
            <div className="text-sm text-ink-600">
              {selectedKeys.size} selected
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              {/* Selection column header */}
              {selectable && (
                <th className="px-4 py-3 w-12 bg-surface-secondary border-b border-ink-900/10">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={handleSelectAll}
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {/* Column headers */}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    tableHeaderCellVariants({
                      sortable: column.sortable,
                      align: column.align,
                      isSorted: sortColumn === column.key,
                    }),
                    'group'
                  )}
                  style={{ width: column.width }}
                  onClick={() => handleSort(column.key)}
                >
                  <div className="flex items-center gap-1">
                    <span>{column.header}</span>
                    {column.sortable && (
                      <span className="inline-flex">
                        {sortColumn === column.key ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-ink-400 opacity-0 group-hover:opacity-100" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton
                columns={columns.length}
                rows={Math.min(pageSize, 5)}
                selectable={selectable}
              />
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-12 text-center text-ink-500"
                >
                  <div className="flex flex-col items-center gap-2">
                    <MoreHorizontal className="h-8 w-8 text-ink-300" />
                    <p>{searchQuery ? 'No matching results' : emptyMessage}</p>
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchQuery('')}
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => {
                const rowKey = keyExtractor(row);
                const isSelected = selectedKeys.has(rowKey);

                return (
                  <tr
                    key={rowKey}
                    className={cn(
                      tableRowVariants({
                        clickable: !!onRowClick,
                        selected: isSelected,
                      })
                    )}
                    onClick={() => handleRowClick(row)}
                  >
                    {/* Selection checkbox */}
                    {selectable && (
                      <td
                        className={cn(
                          tableCellVariants({ isSelected, clickable: false }),
                          'w-12'
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleSelectRow(row)}
                          aria-label={`Select row ${rowKey}`}
                        />
                      </td>
                    )}
                    {/* Data cells */}
                    {columns.map((column) => (
                      <td
                        key={`${rowKey}-${column.key}`}
                        className={cn(
                          tableCellVariants({
                            align: column.align,
                            isSelected,
                            clickable: !!onRowClick,
                          })
                        )}
                      >
                        {column.render
                          ? column.render(row)
                          : String(
                              (row as Record<string, unknown>)[column.key] ?? ''
                            )}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {paginated && !loading && processedData.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-ink-900/10 bg-surface-secondary">
          <div className="flex items-center gap-2 text-sm text-ink-600">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="h-8 px-2 rounded border border-ink-900/10 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="ml-2">
              {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, processedData.length)} of{' '}
              {processedData.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm text-ink-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 5. EXPORTS
// ============================================================================

export type { DataTableProps, DataTableColumn };
export { DataTable };
export default DataTable;
