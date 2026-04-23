# Subagent Task #003: Create AgentDetailPanel Component

**Parent:** Stream B (3-Pane UI)  
**Issue:** Gitea #2  
**Assignee:** You (Opus/Sonnet subagent)  
**Estimated:** 3 days  

## Task

Create the **right pane** component for the 3-pane layout: `AgentDetailPanel.tsx`

## Design

```
┌─────────────────┐
│ AgentDetailPanel│
├─────────────────┤
│ 📊 Metadata     │
│   - Name        │
│   - Model       │
│   - Created     │
├─────────────────┤
│ 🧠 Memory       │
│   - Blocks list │
│   - Edit buttons│
├─────────────────┤
│ 🔧 Tools        │
│   - Attached    │
│   - Add/Remove  │
├─────────────────┤
│ ⚙️ Settings     │
│   - System msg  │
│   - Temperature │
└─────────────────┘
```

## Files to Create

1. `src/ui/components/AgentDetailPanel.tsx` — Main panel
2. `src/ui/components/MemoryBlockList.tsx` — Memory section
3. `src/ui/components/ToolAttachmentList.tsx` — Tools section

## Integration

- Use `useAppStore` to get `selectedAgentId`
- Fetch agent details from API (or use cached data)
- Read-only mode first (editing in follow-up task)

## Props Interface

```typescript
interface AgentDetailPanelProps {
  agentId: string;
  className?: string;
}
```

## Styling

- Use existing Tailwind classes from project
- Match `Sidebar.tsx` styling patterns
- Width: ~350px (resizable in future)

## Requirements

1. Create component files
2. Add to `App.tsx` layout (right side)
3. Connect to Zustand store
4. Show real agent data (mock if API not ready)
5. Run typecheck

## Output

- 3 new component files
- Updated `App.tsx` with 3-pane layout
- Git commit
- Screenshot description of layout

## Context

- `/home/casey/Projects/letta-oss-ui/src/ui/App.tsx`
- `/home/casey/Projects/letta-oss-ui/src/ui/components/Sidebar.tsx` (styling reference)
- `/home/casey/Projects/letta-oss-ui/OSS_UI_STRUCTURE.md` (3-pane section)
