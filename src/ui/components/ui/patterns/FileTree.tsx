/**
 * FileTree Component - Hierarchical file/folder tree display
 *
 * Features:
 * - Hierarchical file/folder tree display
 * - Expand/collapse folders with chevron icons
 * - File icons based on extension (or default file icon)
 * - Folder icons (closed/open states)
 * - Selection state (single or multi-select)
 * - Context menu slot (right-click handler)
 * - Empty state (no files in folder)
 * - Loading state for async folders
 *
 * Build on top of existing AgentMemoryPanel file tree logic.
 * Uses Icon primitive + Button primitive.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../../utils/cn';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  FileText,
  FileCode,
  FileJson,
  FileImage,
  Loader2,
} from 'lucide-react';

// ============================================================================
// 1. VARIANT CONFIGURATION (cva)
// ============================================================================

const fileTreeVariants = cva('flex flex-col overflow-auto', {
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

const fileTreeItemVariants = cva(
  'flex items-center gap-1.5 py-1.5 px-2 cursor-pointer transition-colors rounded-md mx-1 select-none',
  {
    variants: {
      isSelected: {
        true: 'bg-accent/10 text-accent',
        false: 'hover:bg-ink-900/5 text-ink-700',
      },
      isDisabled: {
        true: 'opacity-50 cursor-not-allowed',
        false: '',
      },
    },
    defaultVariants: {
      isSelected: false,
      isDisabled: false,
    },
  }
);

// ============================================================================
// 2. TYPE DEFINITIONS
// ============================================================================

interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  isLoading?: boolean;
  metadata?: { size?: number; modified?: Date };
}

interface FileTreeProps {
  /** Tree nodes to display */
  nodes: FileTreeNode[];
  /** IDs of selected nodes (controlled) */
  selectedIds?: string[];
  /** IDs of expanded folders (controlled) */
  expandedIds?: string[];
  /** Callback when a node is selected */
  onSelect?: (node: FileTreeNode) => void;
  /** Callback when a folder is expanded */
  onExpand?: (nodeId: string) => void;
  /** Callback when a folder is collapsed */
  onCollapse?: (nodeId: string) => void;
  /** Callback for right-click context menu */
  onContextMenu?: (node: FileTreeNode, e: React.MouseEvent) => void;
  /** Message to show when folder is empty */
  emptyMessage?: string;
  /** Global loading state */
  loading?: boolean;
  /** Allow multiple selection */
  multiSelect?: boolean;
  /** Custom file icon component */
  fileIcon?: React.ComponentType<{ node: FileTreeNode; className?: string }>;
  /** Custom folder icon component */
  folderIcon?: React.ComponentType<{
    node: FileTreeNode;
    isOpen: boolean;
    className?: string;
  }>;
  /** Tree size */
  size?: 'sm' | 'md' | 'lg';
  /** Additional className */
  className?: string;
}

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  size?: 'sm' | 'md' | 'lg';
  fileIcon?: React.ComponentType<{ node: FileTreeNode; className?: string }>;
  folderIcon?: React.ComponentType<{
    node: FileTreeNode;
    isOpen: boolean;
    className?: string;
  }>;
}

// ============================================================================
// 3. UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the appropriate file icon based on file extension
 */
function getFileIconType(name: string): React.ComponentType<{ className?: string }> {
  const ext = name.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'py':
    case 'rs':
    case 'go':
    case 'java':
      return FileCode;
    case 'json':
    case 'yaml':
    case 'yml':
      return FileJson;
    case 'md':
    case 'txt':
    case 'doc':
    case 'docx':
      return FileText;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return FileImage;
    default:
      return File;
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// 4. SUB-COMPONENTS
// ============================================================================

/**
 * FileTreeItem - Individual tree node component
 */
function FileTreeItem({
  node,
  depth,
  isSelected,
  isExpanded,
  onToggle,
  onSelect,
  onContextMenu,
  size = 'md',
  fileIcon: CustomFileIcon,
  folderIcon: CustomFolderIcon,
}: FileTreeItemProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isFolder = node.type === 'folder';

  // Calculate indentation based on depth
  const indentStyle = { paddingLeft: `${depth * 12 + 8}px` };

  // Determine icon size based on tree size
  const iconClass =
    size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <div className="select-none">
      <div
        className={cn(
          fileTreeItemVariants({ isSelected }),
          isFolder ? 'font-medium' : ''
        )}
        style={indentStyle}
        onClick={(e) => {
          e.stopPropagation();
          if (isFolder) {
            onToggle();
          } else {
            onSelect();
          }
        }}
        onContextMenu={onContextMenu}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={isFolder ? isExpanded : undefined}
        data-node-id={node.id}
        data-node-type={node.type}
      >
        {/* Expand/collapse chevron for folders */}
        {isFolder ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="w-4 h-4 flex items-center justify-center text-ink-400 hover:text-ink-600 transition-colors rounded-sm hover:bg-ink-900/5"
            aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
          >
            {node.isLoading ? (
              <Loader2 className={cn(iconClass, 'animate-spin')} />
            ) : (
              <>
                {isExpanded ? (
                  <ChevronDown className={iconClass} />
                ) : (
                  <ChevronRight className={iconClass} />
                )}
              </>
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* File/Folder Icon */}
        <span
          className={cn(
            iconClass,
            isSelected ? 'text-accent' : 'text-ink-500'
          )}
        >
          {isFolder ? (
            CustomFolderIcon ? (
              <span className={iconClass}><CustomFolderIcon node={node} isOpen={isExpanded} className={iconClass} /></span>
            ) : (
              isExpanded ? <FolderOpen className={iconClass} /> : <Folder className={iconClass} />
            )
          ) : (
            CustomFileIcon ? (
              <span className={iconClass}><CustomFileIcon node={node} className={iconClass} /></span>
            ) : (
              (() => {
                const IconComponent = getFileIconType(node.name);
                return <IconComponent className={iconClass} />;
              })()
            )
          )}
        </span>

        {/* Name */}
        <span className={cn('truncate', isSelected ? 'font-medium' : '')}>
          {node.name}
        </span>

        {/* Metadata (file size) */}
        {node.metadata?.size !== undefined && !isFolder && (
          <span className="ml-auto text-xs text-ink-400 tabular-nums">
            {formatFileSize(node.metadata.size)}
          </span>
        )}

        {/* Loading indicator for folders */}
        {isFolder && node.isLoading && (
          <Loader2
            className={cn(iconClass, 'ml-auto animate-spin text-accent')}
          />
        )}
      </div>

      {/* Empty state for folders */}
      {isFolder &&
        isExpanded &&
        hasChildren &&
        node.children?.length === 0 && (
          <div
            className="py-2 px-2 text-sm text-ink-400 italic"
            style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
          >
            Empty folder
          </div>
        )}
    </div>
  );
}

// ============================================================================
// 5. MAIN COMPONENT
// ============================================================================

function FileTree({
  nodes,
  selectedIds = [],
  expandedIds,
  onSelect,
  onExpand,
  onCollapse,
  onContextMenu,
  emptyMessage = 'No files',
  loading = false,
  multiSelect = false,
  fileIcon,
  folderIcon,
  size = 'md' as const,
  className,
  ...props
}: FileTreeProps) {
  // Internal state for uncontrolled mode
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(
    new Set()
  );
  const [internalSelected, setInternalSelected] = useState<Set<string>>(
    new Set()
  );

  // Determine if we're in controlled mode
  const isExpandedControlled = expandedIds !== undefined;
  const isSelectedControlled = selectedIds !== undefined;

  // Use controlled or internal state
  const expanded = isExpandedControlled
    ? new Set(expandedIds)
    : internalExpanded;
  const selected = isSelectedControlled
    ? new Set(selectedIds)
    : internalSelected;

  // Toggle folder expansion
  const handleToggle = useCallback(
    (node: FileTreeNode) => {
      const isExpanded = expanded.has(node.id);
      const nextExpanded = new Set(expanded);

      if (isExpanded) {
        nextExpanded.delete(node.id);
        onCollapse?.(node.id);
      } else {
        nextExpanded.add(node.id);
        onExpand?.(node.id);
      }

      if (!isExpandedControlled) {
        setInternalExpanded(nextExpanded);
      }
    },
    [expanded, isExpandedControlled, onExpand, onCollapse]
  );

  // Handle node selection
  const handleSelect = useCallback(
    (node: FileTreeNode) => {
      if (node.type === 'file') {
        const nextSelected = new Set(selected);

        if (multiSelect) {
          // Toggle selection in multi-select mode
          if (nextSelected.has(node.id)) {
            nextSelected.delete(node.id);
          } else {
            nextSelected.add(node.id);
          }
        } else {
          // Single select mode - clear others
          nextSelected.clear();
          nextSelected.add(node.id);
        }

        if (!isSelectedControlled) {
          setInternalSelected(nextSelected);
        }

        onSelect?.(node);
      }
    },
    [selected, multiSelect, isSelectedControlled, onSelect]
  );

  // Handle context menu
  const handleContextMenu = useCallback(
    (node: FileTreeNode, e: React.MouseEvent) => {
      e.preventDefault();
      onContextMenu?.(node, e);
    },
    [onContextMenu]
  );

  // Recursively render tree nodes
  const renderNodes = useCallback(
    (nodes: FileTreeNode[], depth: number): React.ReactNode => {
      return nodes.map((node) => {
        const isExpanded = expanded.has(node.id);
        const isSelected = selected.has(node.id);
        const hasChildren = node.children && node.children.length > 0;

        return (
          <div key={node.id} role="group">
            <FileTreeItem
              node={node}
              depth={depth}
              isSelected={isSelected}
              isExpanded={isExpanded}
              onToggle={() => handleToggle(node)}
              onSelect={() => handleSelect(node)}
              onContextMenu={(e) => handleContextMenu(node, e)}
              size={size}
              fileIcon={fileIcon}
              folderIcon={folderIcon}
            />

            {/* Render children if expanded */}
            {node.type === 'folder' && isExpanded && hasChildren && (
              <div role="group">{renderNodes(node.children!, depth + 1)}</div>
            )}
          </div>
        );
      });
    },
    [
      expanded,
      selected,
      handleToggle,
      handleSelect,
      handleContextMenu,
      size,
      fileIcon,
      folderIcon,
    ]
  );

  // Global loading state
  if (loading) {
    return (
      <div
        className={cn(
          fileTreeVariants({ size }),
          'items-center justify-center p-8',
          className
        )}
        role="tree"
        aria-busy="true"
        {...props}
      >
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <span className="sr-only">Loading file tree...</span>
      </div>
    );
  }

  // Empty state
  if (nodes.length === 0) {
    return (
      <div
        className={cn(
          fileTreeVariants({ size }),
          'items-center justify-center p-8',
          className
        )}
        role="tree"
        {...props}
      >
        <div className="text-center">
          <Folder className="h-10 w-10 mx-auto text-ink-300 mb-2" />
          <p className="text-sm text-ink-400">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(fileTreeVariants({ size }), className)}
      role="tree"
      aria-multiselectable={multiSelect}
      {...props}
    >
      {renderNodes(nodes, 0)}
    </div>
  );
}

// ============================================================================
// 6. EXPORTS
// ============================================================================

export {
  FileTree,
  FileTreeItem,
  fileTreeVariants,
  fileTreeItemVariants,
  getFileIconType,
  formatFileSize,
};

export type { FileTreeProps, FileTreeItemProps, FileTreeNode };
export default FileTree;
