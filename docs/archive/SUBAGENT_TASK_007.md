# Subagent Task #007: Add Memory Editing to AgentDetailPanel

**Parent:** Stream B (3-Pane UI) — Issue #2  
**Warning:** Multiple agents working concurrently. Commit fast, no attribution.  
**Blocked by:** Task #006 (resizable panels) — can start after that completes.

## Task

Add click-to-edit functionality for memory blocks in AgentDetailPanel.

## Current State

MemoryBlockList is read-only. Need:
1. Click block → enter edit mode
2. Edit text area
3. Save button → API call
4. Cancel button → revert

## Implementation

### 1. Update MemoryBlockList.tsx

Add edit state per block:
```typescript
const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
const [editContent, setEditContent] = useState<string>('');
```

### 2. Edit UI

```tsx
{editingBlockId === block.id ? (
  <div>
    <textarea 
      value={editContent}
      onChange={(e) => setEditContent(e.target.value)}
      rows={6}
    />
    <div className="flex gap-2">
      <button onClick={() => handleSave(block.id)}>Save</button>
      <button onClick={() => setEditingBlockId(null)}>Cancel</button>
    </div>
  </div>
) : (
  <div onClick={() => startEdit(block)}>
    {extractBlockText(block.content)}
  </div>
)}
```

### 3. API Integration

```typescript
async function handleSave(blockId: string) {
  // Call community-ade API (or SDK)
  await api.updateMemoryBlock(agentId, blockId, editContent);
  setEditingBlockId(null);
  // Refresh blocks
}
```

## Files

- `/home/casey/Projects/letta-oss-ui/src/ui/components/MemoryBlockList.tsx`
- `/home/casey/Projects/letta-oss-ui/src/ui/store/useAppStore.ts` — Add update action

## Output

- Modified MemoryBlockList.tsx with editing
- Store action for updating blocks
- Git commit (fast, no attribution)
- Status report
