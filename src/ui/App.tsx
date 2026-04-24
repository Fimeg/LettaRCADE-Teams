import { useCallback, useEffect, useState } from "react";
import { useAppStore, type TopTab } from "./store/useAppStore";
import type { ClientEvent } from "./types";
import { AgentsBrowser } from "./components/AgentsBrowser";
import { AgentWorkspace } from "./components/AgentWorkspace";
import { AgentWizard } from "./components/agents/AgentWizard";
import { ModelsView } from "./components/ModelsView";
import { SettingsPanel } from "./components/SettingsPanel";
import { LettaCodeLogPanel } from "./components/LettaCodeLogPanel";
import { StartSessionModal } from "./components/StartSessionModal";
import { useIPC } from "./hooks/useIPC";

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

  const onSelectAgent = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
    setActiveTab('agents');
  }, [setSelectedAgentId, setActiveTab]);

  const onBackToBrowser = useCallback(() => {
    setSelectedAgentId(null);
  }, [setSelectedAgentId]);

  // Tab button component
  const TabButton = ({ tab, label, icon }: { tab: TopTab; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
        activeTab === tab
          ? 'text-accent border-b-2 border-accent'
          : 'text-ink-600 hover:text-ink-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  // Determine main content based on state
  const renderMainContent = () => {
    // If an agent is selected, show the workspace
    if (selectedAgentId) {
      return (
        <AgentWorkspace
          agentId={selectedAgentId}
          onBack={onBackToBrowser}
          sendEvent={sendEvent as (event: ClientEvent) => void}
        />
      );
    }

    // Otherwise show browser or other tabs
    switch (activeTab) {
      case 'agents':
        return (
          <AgentsBrowser
            agents={agentList}
            loading={agentsLoading}
            onSelectAgent={onSelectAgent}
            onCreateAgent={() => setShowWizard(true)}
          />
        );
      case 'models':
        return <ModelsView />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-surface">
      {/* Header with tabs and connection status */}
      <header className="flex items-center justify-between h-14 border-b border-ink-900/10 bg-surface select-none px-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${serverConnected === true ? 'bg-green-500' : serverConnected === false ? 'bg-red-500' : 'bg-amber-500'}`} />
            <span className="text-sm font-semibold text-ink-900">Letta Community ADE</span>
          </div>
          <nav className="flex items-center">
            <TabButton
              tab="agents"
              label="Agents"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
            />
            <TabButton
              tab="models"
              label="Models"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>}
            />
            <TabButton
              tab="settings"
              label="Settings"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            />
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-xs ${serverConnected ? 'text-green-600' : 'text-red-600'}`}>
            {serverConnected ? '● Connected' : '○ Disconnected'}
          </span>
        </div>
      </header>

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
