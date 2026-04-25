/**
 * Demo component for MemfsFileTree
 * Shows both empty state and populated file tree views
 */

import { useState } from "react";
import { MemfsFileTree } from "./MemfsFileTree";
import type { MemoryBlock } from "../store/useAppStore";

// Mock data simulating path-like memory blocks
const mockBlocks: MemoryBlock[] = [
  {
    id: "1",
    label: "docs/readme",
    value: "# Project Documentation\n\nThis is the readme file for the project.",
    content: { text: "# Project Documentation\n\nThis is the readme file for the project." },
  },
  {
    id: "2",
    label: "docs/architecture",
    value: "## Architecture Overview\n\nThe system uses a modular design...",
    content: { text: "## Architecture Overview\n\nThe system uses a modular design..." },
  },
  {
    id: "3",
    label: "src/main",
    value: "console.log('Hello from main');\n\nfunction init() {\n  // Initialize app\n}",
    content: { text: "console.log('Hello from main');\n\nfunction init() {\n  // Initialize app\n}" },
  },
  {
    id: "4",
    label: "src/utils/helpers",
    value: "export function formatDate(date: Date): string {\n  return date.toISOString();\n}",
    content: { text: "export function formatDate(date: Date): string {\n  return date.toISOString();\n}" },
  },
  {
    id: "5",
    label: "config/settings",
    value: "{\n  \"debug\": true,\n  \"timeout\": 5000\n}",
    content: { text: "{\n  \"debug\": true,\n  \"timeout\": 5000\n}" },
  },
];

export function MemfsFileTreeDemo() {
  const [blocks, setBlocks] = useState<MemoryBlock[]>(mockBlocks);
  const [lastAction, setLastAction] = useState<string>("No actions yet");

  const handleUpdateFile = async (path: string, content: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.label === path
          ? { ...b, value: content, content: { text: content } }
          : b
      )
    );
    setLastAction(`Updated ${path}`);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));
  };

  const handleCreateFile = (path: string) => {
    const newBlock: MemoryBlock = {
      id: `new-${Date.now()}`,
      label: path,
      value: "",
      content: { text: "" },
    };
    setBlocks((prev) => [...prev, newBlock]);
    setLastAction(`Created file ${path}`);
  };

  const handleCreateFolder = (path: string) => {
    // Folders are implicit in memfs, but we could track them separately if needed
    setLastAction(`Created folder ${path}`);
  };

  const handleDeleteNode = (path: string) => {
    setBlocks((prev) => prev.filter((b) => !b.label.startsWith(path)));
    setLastAction(`Deleted ${path}`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-ink-900">MemfsFileTree Demo</h1>
        <p className="text-sm text-ink-600">
          This demo shows the file tree editor for memfs-compatible agents.
          The file tree is built from memory blocks with path-like labels.
        </p>
        <p className="text-xs text-accent font-medium">Last action: {lastAction}</p>
      </div>

      <div className="border border-ink-900/10 rounded-xl overflow-hidden" style={{ height: "500px" }}>
        <MemfsFileTree
          blocks={blocks}
          onUpdateFile={handleUpdateFile}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onDeleteNode={handleDeleteNode}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-ink-900/10 p-4 bg-surface-secondary">
          <h3 className="text-sm font-medium text-ink-800 mb-2">Raw Memory Blocks</h3>
          <pre className="text-xs text-ink-600 overflow-auto max-h-48">
            {JSON.stringify(blocks, null, 2)}
          </pre>
        </div>

        <div className="rounded-lg border border-ink-900/10 p-4 bg-surface-secondary">
          <h3 className="text-sm font-medium text-ink-800 mb-2">Features</h3>
          <ul className="text-xs text-ink-600 space-y-1 list-disc list-inside">
            <li>Tree view from path-like labels (e.g., docs/readme)</li>
            <li>Click to select and edit file content</li>
            <li>Right-click for context menu (create/delete)</li>
            <li>Toolbar buttons for new file/folder</li>
            <li>Dirty indicator for unsaved changes</li>
            <li>File icons based on extension</li>
            <li>Expand/collapse directories</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default MemfsFileTreeDemo;
