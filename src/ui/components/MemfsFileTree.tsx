import { useState, useCallback, useMemo } from "react";
import type { MemoryBlock } from "../store/useAppStore";

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  content?: string;
  isDirty?: boolean;
}

export interface MemfsFileTreeProps {
  blocks: MemoryBlock[];
  onUpdateFile: (path: string, content: string) => Promise<void>;
  onCreateFile?: (path: string) => void;
  onCreateFolder?: (path: string) => void;
  onDeleteNode?: (path: string) => void;
  readOnly?: boolean;
}

// Build a tree structure from memory blocks with path-like labels
function buildTreeFromBlocks(blocks: MemoryBlock[]): FileNode[] {
  const root: FileNode[] = [];
  const nodeMap = new Map<string, FileNode>();

  // Sort blocks by path to ensure parents are created before children
  const sortedBlocks = [...blocks].sort((a, b) => a.label.localeCompare(b.label));

  for (const block of sortedBlocks) {
    const pathParts = block.label.split('/').filter(Boolean);
    if (pathParts.length === 0) continue;

    let currentPath = '';

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      const isLastPart = i === pathParts.length - 1;
      const existingNode = nodeMap.get(currentPath);

      if (!existingNode) {
        const newNode: FileNode = {
          id: `node-${currentPath}`,
          name: part,
          path: currentPath,
          type: isLastPart ? 'file' : 'directory',
          children: isLastPart ? undefined : [],
          content: isLastPart ? (block.value || '') : undefined,
        };

        nodeMap.set(currentPath, newNode);

        if (parentPath) {
          const parent = nodeMap.get(parentPath);
          if (parent && parent.children) {
            parent.children.push(newNode);
          }
        } else {
          root.push(newNode);
        }
      } else if (isLastPart) {
        // Update existing file node with content
        existingNode.content = block.value || '';
      }
    }
  }

  return root;
}

// Get file icon based on extension
function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return '📜';
    case 'json':
      return '📋';
    case 'md':
    case 'txt':
      return '📝';
    case 'css':
    case 'scss':
    case 'less':
      return '🎨';
    case 'html':
    case 'htm':
      return '🌐';
    case 'py':
      return '🐍';
    case 'rs':
      return '🦀';
    case 'go':
      return '🔵';
    case 'yml':
    case 'yaml':
      return '⚙️';
    default:
      return '📄';
  }
}

// Individual tree node component
interface TreeNodeProps {
  node: FileNode;
  level: number;
  expandedNodes: Set<string>;
  selectedNode: string | null;
  onToggleExpand: (path: string) => void;
  onSelect: (node: FileNode) => void;
  onContextMenu?: (e: React.MouseEvent, node: FileNode) => void;
}

function TreeNode({
  node,
  level,
  expandedNodes,
  selectedNode,
  onToggleExpand,
  onSelect,
  onContextMenu,
}: TreeNodeProps) {
  const isExpanded = expandedNodes.has(node.path);
  const isSelected = selectedNode === node.path;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1.5 py-1.5 px-2 cursor-pointer transition-colors rounded-md mx-1 ${
          isSelected
            ? 'bg-accent/10 text-accent'
            : 'hover:bg-ink-900/5 text-ink-700'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => node.type === 'directory' ? onToggleExpand(node.path) : onSelect(node)}
        onContextMenu={(e) => onContextMenu?.(e, node)}
      >
        {/* Expand/collapse chevron for directories */}
        {node.type === 'directory' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.path);
            }}
            className="w-4 h-4 flex items-center justify-center text-ink-400 hover:text-ink-600"
          >
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Icon */}
        <span className="text-sm">
          {node.type === 'directory' ? (
            isExpanded ? '📂' : '📁'
          ) : (
            getFileIcon(node.name)
          )}
        </span>

        {/* Name */}
        <span className={`text-sm truncate ${isSelected ? 'font-medium' : ''}`}>
          {node.name}
        </span>

        {/* Dirty indicator */}
        {node.isDirty && (
          <span className="w-2 h-2 rounded-full bg-amber-500 ml-auto" title="Unsaved changes" />
        )}
      </div>

      {/* Children */}
      {node.type === 'directory' && isExpanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              selectedNode={selectedNode}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Context menu component
interface ContextMenuProps {
  x: number;
  y: number;
  node: FileNode | null;
  onClose: () => void;
  onCreateFile: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
  onDelete: (path: string) => void;
}

function ContextMenu({ x, y, node, onClose, onCreateFile, onCreateFolder, onDelete }: ContextMenuProps) {
  const menuRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      // Adjust position if menu goes off screen
      const rect = node.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 8;
      }
      if (y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 8;
      }

      node.style.left = `${adjustedX}px`;
      node.style.top = `${adjustedY}px`;
    }
  }, [x, y]);

  const parentPath = node?.type === 'directory' ? node.path : node?.path.split('/').slice(0, -1).join('/') || '';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Menu */}
      <div
        ref={menuRef}
        className="fixed z-50 min-w-[160px] rounded-lg bg-surface border border-ink-900/10 shadow-lg py-1"
        style={{ left: x, top: y }}
      >
        <button
          onClick={() => {
            onCreateFile(parentPath);
            onClose();
          }}
          className="w-full px-3 py-1.5 text-left text-sm text-ink-700 hover:bg-ink-900/5 flex items-center gap-2"
        >
          <span>📄</span> New File
        </button>
        <button
          onClick={() => {
            onCreateFolder(parentPath);
            onClose();
          }}
          className="w-full px-3 py-1.5 text-left text-sm text-ink-700 hover:bg-ink-900/5 flex items-center gap-2"
        >
          <span>📁</span> New Folder
        </button>
        {node && (
          <>
            <div className="h-px bg-ink-900/10 my-1" />
            <button
              onClick={() => {
                onDelete(node.path);
                onClose();
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <span>🗑️</span> Delete
            </button>
          </>
        )}
      </div>
    </>
  );
}

// Main component
export function MemfsFileTree({
  blocks,
  onUpdateFile,
  onCreateFile,
  onCreateFolder,
  onDeleteNode,
  readOnly = false,
}: MemfsFileTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode | null } | null>(null);
  const [createModal, setCreateModal] = useState<{ type: 'file' | 'folder'; parentPath: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const tree = useMemo(() => buildTreeFromBlocks(blocks), [blocks]);

  const selectedFileNode = useMemo(() => {
    if (!selectedNode) return null;
    const findNode = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.path === selectedNode) return node;
        if (node.children) {
          const found = findNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findNode(tree);
  }, [selectedNode, tree]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback((node: FileNode) => {
    if (node.type === 'file') {
      setSelectedNode(node.path);
      setEditingContent(node.content || '');
      setIsDirty(false);
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const handleBackgroundContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node: null });
  }, []);

  const handleContentChange = useCallback((newContent: string) => {
    setEditingContent(newContent);
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedNode || !isDirty) return;
    setIsSaving(true);
    try {
      await onUpdateFile(selectedNode, editingContent);
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  }, [selectedNode, editingContent, isDirty, onUpdateFile]);

  const handleCreate = useCallback(() => {
    if (!createModal || !newName.trim()) return;
    const fullPath = createModal.parentPath
      ? `${createModal.parentPath}/${newName.trim()}`
      : newName.trim();

    if (createModal.type === 'file') {
      onCreateFile?.(fullPath);
    } else {
      onCreateFolder?.(fullPath);
    }
    setCreateModal(null);
    setNewName('');
  }, [createModal, newName, onCreateFile, onCreateFolder]);

  const handleDelete = useCallback((path: string) => {
    setDeleteConfirm(path);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteConfirm) {
      onDeleteNode?.(deleteConfirm);
      if (selectedNode === deleteConfirm) {
        setSelectedNode(null);
        setEditingContent('');
      }
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, onDeleteNode, selectedNode]);

  return (
    <div className="flex h-full">
      {/* Tree sidebar */}
      <div
        className="w-64 border-r border-ink-900/10 overflow-y-auto bg-surface-secondary/50"
        onContextMenu={handleBackgroundContextMenu}
      >
        {/* Tree header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-ink-900/10">
          <span className="text-xs font-medium text-ink-500 uppercase tracking-wider">Files</span>
          <div className="flex gap-1">
            <button
              onClick={() => setCreateModal({ type: 'file', parentPath: '' })}
              className="p-1 rounded hover:bg-ink-900/10 text-ink-400 hover:text-ink-600"
              title="New File"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <button
              onClick={() => setCreateModal({ type: 'folder', parentPath: '' })}
              className="p-1 rounded hover:bg-ink-900/10 text-ink-400 hover:text-ink-600"
              title="New Folder"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tree content */}
        <div className="py-2">
          {tree.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-ink-400">No files yet</p>
              <p className="text-xs text-ink-300 mt-1">Right-click to create</p>
            </div>
          ) : (
            tree.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                level={0}
                expandedNodes={expandedNodes}
                selectedNode={selectedNode}
                onToggleExpand={toggleExpand}
                onSelect={handleSelect}
                onContextMenu={handleContextMenu}
              />
            ))
          )}
        </div>
      </div>

      {/* Editor panel */}
      <div className="flex-1 flex flex-col bg-surface">
        {selectedFileNode ? (
          <>
            {/* Editor header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-ink-900/10">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink-800">
                  {selectedFileNode.name}
                </span>
                {isDirty && (
                  <span className="text-xs text-amber-600 font-medium">● Modified</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-400">
                  {editingContent.length} chars
                </span>
                {!readOnly && (
                  <button
                    onClick={handleSave}
                    disabled={!isDirty || isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Editor content */}
            <div className="flex-1 p-4">
              <textarea
                value={editingContent}
                onChange={(e) => handleContentChange(e.target.value)}
                disabled={isSaving || readOnly}
                className="w-full h-full resize-none rounded-lg border border-ink-900/10 bg-surface-secondary px-4 py-3 text-sm font-mono text-ink-800 focus:border-accent focus:outline-none disabled:opacity-50 leading-relaxed"
                placeholder="Enter file content..."
                spellCheck={false}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-ink-900/5 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-ink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm text-ink-500">Select a file to edit</p>
            <p className="text-xs text-ink-400 mt-1">Or right-click in the file tree to create new files</p>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onClose={() => setContextMenu(null)}
          onCreateFile={(parentPath) => setCreateModal({ type: 'file', parentPath })}
          onCreateFolder={(parentPath) => setCreateModal({ type: 'folder', parentPath })}
          onDelete={handleDelete}
        />
      )}

      {/* Create modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl bg-surface p-4 shadow-lg w-80">
            <h3 className="text-sm font-medium text-ink-800 mb-3">
              Create New {createModal.type === 'file' ? 'File' : 'Folder'}
            </h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder={createModal.type === 'file' ? 'filename.txt' : 'foldername'}
              className="w-full rounded-lg border border-ink-900/10 bg-surface px-3 py-2 text-sm text-ink-800 focus:border-accent focus:outline-none mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setCreateModal(null);
                  setNewName('');
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-tertiary text-ink-600 hover:bg-ink-900/10"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl bg-surface p-4 shadow-lg max-w-sm mx-4">
            <p className="text-sm text-ink-800 mb-4">
              Delete <span className="font-medium">{deleteConfirm}</span>?
              <br />
              <span className="text-xs text-ink-500">This action cannot be undone.</span>
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-tertiary text-ink-600 hover:bg-ink-900/10"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MemfsFileTree;
