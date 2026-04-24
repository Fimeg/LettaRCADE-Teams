# Subagent Task #006: Add Resizable Panels to 3-Pane Layout

**Parent:** Stream B (3-Pane UI) — Issue #2  
**Warning:** Multiple agents working concurrently. Commit fast, no attribution.

## Task

Add resizable panel handles to the 3-pane layout.

## Current Layout (Fixed)

```
Sidebar (280px) | Chat (flex) | AgentDetailPanel (350px)
```

## Target (Resizable)

```
Sidebar | ←drag→ | Chat | ←drag→ | AgentDetailPanel
```

## Implementation

Use `react-resizable-panels`:
```bash
cd /home/casey/Projects/letta-oss-ui && npm install react-resizable-panels
```

## Changes to App.tsx

Wrap the three panels in `<PanelGroup>` with `<PanelResizeHandle>`:

```tsx
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

<PanelGroup direction="horizontal">
  <Panel defaultSize={20} minSize={15}>
    <Sidebar />
  </Panel>
  <PanelResizeHandle />
  <Panel defaultSize={60} minSize={30}>
    <ChatArea />
  </Panel>
  <PanelResizeHandle />
  <Panel defaultSize={20} minSize={15}>
    <AgentDetailPanel agentId={selectedAgentId} />
  </Panel>
</PanelGroup>
```

## Styling

Add resize handle styles to `index.css`:
```css
.PanelResizeHandle {
  width: 4px;
  background: var(--border-color);
  cursor: col-resize;
}
.PanelResizeHandle:hover {
  background: var(--accent-color);
}
```

## Files

- `/home/casey/Projects/letta-oss-ui/src/ui/App.tsx` — Refactor layout
- `/home/casey/Projects/letta-oss-ui/src/ui/index.css` — Add handle styles

## Output

- Modified App.tsx with resizable panels
- Updated index.css with handle styles
- Git commit (fast, no attribution)
- Status report
