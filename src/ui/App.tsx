import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppStore, type TopTab } from "./store/useAppStore";
import { calculateMemoryHealth } from "./utils/memoryHealth";
import type { ClientEvent } from "./types";
import { AgentsBrowser } from "./components/AgentsBrowser";
import { AgentWorkspace } from "./components/AgentWorkspace";
import { AgentWizard } from "./components/agents/AgentWizard";
import { SettingsPanel } from "./components/SettingsPanel";
import { TeamsView } from "./components/TeamsView";
import { FavoriteAgentView } from "./components/FavoriteAgentView";
import { LettaCodeLogPanel } from "./components/LettaCodeLogPanel";
import { OperatorSetupView } from "./components/OperatorSetupView";
import { StartSessionModal } from "./components/StartSessionModal";
import { useIPC } from "./hooks/useIPC";
import { TopNav, TopNavTitle, TopNavActions } from "./components/ui/layout/TopNav";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/layout/Tabs";
import { Button } from "./components/ui/primitives/Button";
import { Icon } from "./components/ui/primitives/Icon";
import { Home, MonitorSmartphone, Settings, ArrowRight, Users } from "lucide-react";

function App() {
  // Modal state
  const showStartModal = useAppStore((s) => s.showStartModal);
  const setShowStartModal = useAppStore((s) => s.setShowStartModal);
  const globalError = useAppStore((s) => s.globalError);
  const setGlobalError = useAppStore((s) => s.setGlobalError);
  const prompt = useAppStore((s) => s.prompt);
  const setPrompt = useAppStore((s) => s.setPrompt);
  const cwd = useAppStore((s) => s.cwd);
  const setCwd = useAppStore((s) => s.setCwd);
  const pendingStart = useAppStore((s) => s.pendingStart);
  const handleServerEvent = useAppStore((s) => s.handleServerEvent);

  // Agent state
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId);
  const setSelectedAgentId = useAppStore((s) => s.setSelectedAgentId);
  const agentList = useAppStore((s) => s.agentList);
  const agentsLoading = useAppStore((s) => s.agentsLoading);
  const loadAgentList = useAppStore((s) => s.loadAgentList);
  const loadAgent = useAppStore((s) => s.loadAgent);
  const serverConnected = useAppStore((s) => s.serverConnected);
  const setServerConnected = useAppStore((s) => s.setServerConnected);
  const favoriteAgentId = useAppStore((s) => s.favoriteAgentId);
  const setFavoriteAgentId = useAppStore((s) => s.setFavoriteAgentId);
  const operatorProfile = useAppStore((s) => s.operatorProfile);
  const operatorProfileLoaded = useAppStore((s) => s.operatorProfileLoaded);
  const loadOperatorProfile = useAppStore((s) => s.loadOperatorProfile);
  // Full loaded agent record for the favorite — drives recent conversations
  // and the real memory-pressure number on the Home dashboard.
  const favoriteAgentFull = useAppStore((s) => (favoriteAgentId ? s.agents[favoriteAgentId] : null));

  // IPC for sending events to backend
  const { sendEvent } = useIPC(handleServerEvent);

  // Agent creation wizard
  const [showWizard, setShowWizard] = useState(false);

  const handleAgentCreated = useCallback(async (agentId: string) => {
    setShowWizard(false);
    await loadAgentList();
    setSelectedAgentId(agentId);
    setActiveTab('agents');
  }, [loadAgentList, setSelectedAgentId, setActiveTab]);

  // Load operator profile on mount. The wizard gate (below) blocks the rest
  // of the app until this resolves; renderer-only dev (no Electron) marks
  // loaded=true with profile=null and the gate falls through.
  useEffect(() => {
    loadOperatorProfile();
  }, [loadOperatorProfile]);

  // Load agent list on mount (health check)
  useEffect(() => {
    const checkConnection = async () => {
      try {
        await loadAgentList();
        setServerConnected(true);
      } catch {
        setServerConnected(false);
      }
    };
    checkConnection();
  }, [setServerConnected, loadAgentList]);

  // Load selected agent details
  useEffect(() => {
    if (selectedAgentId) {
      loadAgent(selectedAgentId);
    }
  }, [selectedAgentId, loadAgent]);

  // Eagerly load the favorite agent so the Home dashboard has real data
  // (conversations, memory blocks for pressure calc) without requiring the
  // user to navigate into the workspace first.
  useEffect(() => {
    if (favoriteAgentId && !favoriteAgentFull?.loaded) {
      loadAgent(favoriteAgentId);
    }
  }, [favoriteAgentId, favoriteAgentFull?.loaded, loadAgent]);

  const onSelectAgent = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
    setActiveTab('agents');
  }, [setSelectedAgentId, setActiveTab]);

  const onBackToBrowser = useCallback(() => {
    setSelectedAgentId(null);
  }, [setSelectedAgentId]);

  // Tab configuration with icons
  const mainTabs = useMemo(() => [
    { id: 'home' as TopTab, label: 'Home', icon: Home },
    { id: 'agents' as TopTab, label: 'Agents', icon: MonitorSmartphone },
    { id: 'settings' as TopTab, label: 'Settings', icon: Settings },
  ], []);

  // Determine main content based on state. The active tab is the single
  // source of truth — switching tabs from inside an agent leaves the agent
  // selected but renders the other tab's content. Returning to the Agents
  // tab restores the workspace.
  const favoriteAgent = favoriteAgentId ? agentList.find(a => a.id === favoriteAgentId) : null;

  // Map `favoriteAgentFull.conversations` into the dashboard shape. Sorts
  // newest-first by last activity so the most relevant chat surfaces.
  const favoriteRecentConversations = useMemo(() => {
    const convs = favoriteAgentFull?.conversations ?? [];
    return [...convs]
      .sort((a, b) => {
        const ta = Date.parse(a.last_message_at ?? a.updated_at ?? a.created_at ?? '') || 0;
        const tb = Date.parse(b.last_message_at ?? b.updated_at ?? b.created_at ?? '') || 0;
        return tb - ta;
      })
      .map((c) => {
        const summary = (c as { summary?: string | null }).summary?.trim();
        return {
          id: c.id,
          title: summary && summary.length > 0 ? summary : `Conversation ${c.id.slice(0, 8)}`,
          lastMessageAt: c.last_message_at ?? c.updated_at ?? c.created_at ?? undefined,
          messageCount: (c as { message_count?: number }).message_count,
        };
      });
  }, [favoriteAgentFull]);

  // Compute real health stats for the dashboard. Memory pressure comes from
  // the loaded blocks; status is derived from last activity.
  const favoriteHealth = useMemo(() => {
    const blocks = favoriteAgentFull?.memoryBlocks ?? [];
    const health = calculateMemoryHealth(blocks);
    const pressurePercent = Math.round(Math.min(Math.max(health.overallPressure, 0), 1) * 100);

    const lastActivityAt =
      favoriteAgent?.lastRun
        ?? (favoriteRecentConversations[0]?.lastMessageAt)
        ?? undefined;

    let status: 'active' | 'idle' | 'stale' | 'unknown' = 'unknown';
    if (lastActivityAt) {
      const ageMs = Date.now() - Date.parse(lastActivityAt);
      const day = 24 * 60 * 60 * 1000;
      if (Number.isNaN(ageMs)) status = 'unknown';
      else if (ageMs < day) status = 'active';
      else if (ageMs < 14 * day) status = 'idle';
      else status = 'stale';
    } else if (favoriteAgentFull?.loaded) {
      status = 'idle';
    }

    const curatorHealth: 'healthy' | 'degraded' | 'critical' | undefined =
      !favoriteAgentFull?.loaded
        ? undefined
        : health.needsAttention
          ? (health.overallPressure > 0.9 ? 'critical' : 'degraded')
          : 'healthy';

    return { pressurePercent, status, lastActivityAt, curatorHealth };
  }, [favoriteAgent, favoriteAgentFull, favoriteRecentConversations]);

  // Navigate from the Home dashboard into the agent workspace. All three
  // dashboard buttons (Chat/Memory/Settings) land in the same workspace,
  // but Chat pre-arms focus mode (chat-only, side panels hidden) while
  // Memory/Settings explicitly clear it so the full 3-pane layout shows.
  // Focus state is persisted per agent in localStorage; AgentWorkspace
  // reads the same key on mount.
  const navigateToAgent = useAppStore((s) => s.navigateToAgent);
  const openFavoriteAgent = useCallback((agentId: string, mode: 'focus' | 'full') => {
    try {
      const key = `letta:focus-mode:${agentId}`;
      if (mode === 'focus') localStorage.setItem(key, 'true');
      else localStorage.removeItem(key);
    } catch { /* ignore */ }
    navigateToAgent(agentId, 'agents');
  }, [navigateToAgent]);

  const renderMainContent = () => {
    switch (activeTab) {
      case 'home':
        if (favoriteAgent) {
          return (
            <FavoriteAgentView
              agent={favoriteAgent}
              onChat={() => openFavoriteAgent(favoriteAgent.id, 'focus')}
              onEditMemory={() => openFavoriteAgent(favoriteAgent.id, 'full')}
              onSettings={() => openFavoriteAgent(favoriteAgent.id, 'full')}
              onViewAllAgents={() => setActiveTab('agents')}
              recentConversations={favoriteRecentConversations}
              health={{
                memoryPressure: favoriteHealth.pressurePercent,
                status: favoriteHealth.status,
                lastActivityAt: favoriteHealth.lastActivityAt,
                curatorHealth: favoriteHealth.curatorHealth,
              }}
            />
          );
        }
        // No favorite set — show CTA to pick one
        return (
          <div className="h-full flex flex-col items-center justify-center bg-surface px-6">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center text-accent mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-ink-900 mb-2">Choose Your Companion</h2>
              <p className="text-sm text-ink-600 mb-6">
                Star an agent in the browser to set them as your home base. You'll get quick access to chat, memory, and health monitoring.
              </p>
              <button
                onClick={() => setActiveTab('agents')}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
              >
                Browse Agents →
              </button>
            </div>
          </div>
        );
      case 'agents':
        if (selectedAgentId) {
          return (
            <AgentWorkspace
              agentId={selectedAgentId}
              onBack={onBackToBrowser}
              sendEvent={sendEvent as (event: ClientEvent) => void}
            />
          );
        }
        // Agents tab ALWAYS shows the grid browser
        return (
          <AgentsBrowser
            agents={agentList}
            loading={agentsLoading}
            onSelectAgent={onSelectAgent}
            onCreateAgent={() => setShowWizard(true)}
            favoriteAgentId={favoriteAgentId}
            onSetFavorite={setFavoriteAgentId}
          />
        );
      case 'teams':
        return <TeamsView />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return null;
    }
  };

  // Teams is treated as a takeover surface — different mental model than ADE
  // (multi-agent orchestration vs. single-agent inspection), so it gets its
  // own header instead of sharing tab chrome.
  const isTeamsMode = activeTab === 'teams';

  // Connection status for header display
  const statusConfig = useMemo(() => {
    if (serverConnected === true) {
      return { dotColor: 'bg-green-500', label: 'Connected', textColor: 'text-green-600' };
    }
    if (serverConnected === false) {
      return { dotColor: 'bg-red-500', label: 'Disconnected', textColor: 'text-red-600' };
    }
    return { dotColor: 'bg-amber-500', label: 'Connecting…', textColor: 'text-amber-600' };
  }, [serverConnected]);

  // First-run gate: Electron present + no operator profile yet → wizard.
  // Vite-only dev (no `window.electron`) skips so the app stays usable
  // without an IPC backend; the save call would fail there anyway.
  const electronCanPersistProfile =
    typeof window !== 'undefined' && !!window.electron?.saveOperatorProfile;
  if (!operatorProfileLoaded) {
    return <div className="h-screen bg-surface" />;
  }
  if (!operatorProfile && electronCanPersistProfile) {
    return (
      <div className="flex flex-col h-screen bg-surface">
        <OperatorSetupView />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-surface">
      {isTeamsMode ? (
        // === Teams takeover header ===
        <TopNav
          actions={
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('agents')}>
              <Icon icon={ArrowRight} size="sm" className="mr-1 rotate-180" />
              Back to ADE
            </Button>
          }
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent">
              <Icon icon={Users} size="md" />
            </div>
            <TopNavTitle title="Letta Teams" subtitle="Multi-agent orchestration" />
          </div>
        </TopNav>
      ) : (
        // === ADE header with Tabs navigation ===
        <TopNav
          actions={
            <TopNavActions>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('teams')}
                className="text-accent hover:text-accent hover:bg-accent/10"
                title="Open Letta Teams — multi-agent orchestration"
              >
                <Icon icon={Users} size="sm" className="mr-1.5" />
                Teams
                <Icon icon={ArrowRight} size="sm" className="ml-1.5 opacity-60" />
              </Button>
            </TopNavActions>
          }
        >
          <div className="flex items-center gap-6 flex-1">
            {/* Brand with status */}
            <div className="flex flex-col leading-tight min-w-[140px]">
              <span className="text-sm font-semibold text-ink-900">Letta Community ADE</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                <span className={`text-[11px] ${statusConfig.textColor}`}>{statusConfig.label}</span>
              </div>
            </div>

            {/* Main navigation tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TopTab)}>
              <TabsList>
                {mainTabs.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    <Icon icon={tab.icon} size="sm" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </TopNav>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        {renderMainContent()}
      </div>

      {/* Legacy session modal - still needed for direct session access */}
      {showStartModal && (
        <StartSessionModal
          cwd={cwd}
          prompt={prompt}
          pendingStart={pendingStart}
          onCwdChange={setCwd}
          onPromptChange={setPrompt}
          onStart={() => { setShowStartModal(false); }}
          onClose={() => setShowStartModal(false)}
        />
      )}

      {/* Agent creation wizard */}
      <AgentWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onCreated={handleAgentCreated}
      />

      {/* Letta-code subprocess debug console (only renders in Electron) */}
      <LettaCodeLogPanel />

      {/* Global error */}
      {globalError && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-error/20 bg-error-light px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm text-error">{globalError}</span>
            <button className="text-error hover:text-error/80" onClick={() => setGlobalError(null)}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
