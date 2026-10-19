
import React, { useState, useCallback, useRef, useMemo } from 'react';
import InstrumentTable from './components/InstrumentTable';
import HmiReactFlowView from './components/HmiReactFlowView';
import AuditBOM from './components/AuditBOM';
import { Instrument, AnalysisProject } from './types';
import { analyzePIDImage, generateDigitalTwin, setAiAccessToken } from './services/geminiService';
import { downloadSiemensCSV, downloadABBXML, downloadBomCSV, downloadText } from './services/exportService';
import { normalizeInstrument } from './services/normalizeInstruments';
import { assertProjectBackupBytes, parseProjectBackup, serializeProject } from './services/projectBackup';
import { runSentinelAudit } from './services/otSentinelService';
import { conceptExportBlockers } from './services/conceptExportGate';
import { buildReviewedTagMap } from './services/nexusTagMap';
import { serializeNexusTagMapV1 } from './services/nexusTagMapReader';
import { applyInstrumentUpdate } from './services/reviewState';
import { prepareImage, validateImageFile } from './services/imageUpload';
import { useProjects } from './hooks/useProjects';
import { createSyntheticDemoProject } from './services/offlineDemo';

type TabView = 'list' | 'hmi' | 'bom';
type LeftPanelView = 'image' | 'draft_hmi' | 'twin';

const App: React.FC = () => {
  const { projects, currentProject, selectProject, addProject, updateProject, editInstruments,
    removeProject, undoInstruments, redoInstruments, canUndo, canRedo, storageWarning } = useProjects();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingTwin, setIsGeneratingTwin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Only the token entry field has React state; the committed secret stays in
  // ephemeral module memory and never in browser persistence or project data.
  const [aiTokenDraft, setAiTokenDraft] = useState('');
  const [aiAccessConfigured, setAiAccessConfigured] = useState(false);

  const applyAiAccessToken = () => {
    const candidate = aiTokenDraft.trim();
    if (candidate.length < 32) {
      setErrorMessage('An operator-issued AI access token of at least 32 characters is required.');
      return;
    }
    setAiAccessToken(candidate);
    setAiTokenDraft('');
    setAiAccessConfigured(true);
    setErrorMessage(null);
  };

  const clearAiAccessToken = () => {
    setAiAccessToken(null);
    setAiTokenDraft('');
    setAiAccessConfigured(false);
  };
  const [zoom, setZoom] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('list');
  const [leftPanelView, setLeftPanelView] = useState<LeftPanelView>('image');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const sentinelAlerts = useMemo(() => {
    if (!currentProject) return [];
    return runSentinelAudit(currentProject.instruments);
  }, [currentProject?.instruments]);
  const exportBlockers = useMemo(
    () => conceptExportBlockers(currentProject?.instruments ?? []),
    [currentProject?.instruments],
  );
  const conceptExportDisabled = !currentProject || exportBlockers.length > 0;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the same file again still triggers a change event
    event.target.value = '';
    if (!file) return;

    const invalid = validateImageFile(file);
    if (invalid) {
      setErrorMessage(invalid);
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const image = await prepareImage(file);
      const instruments = await analyzePIDImage(image.base64, image.mimeType);
      addProject({
        id: `proj-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ""),
        date: new Date().toLocaleString(),
        imageUrl: image.dataUrl,
        instruments,
      });
    } catch (err) {
      setErrorMessage(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadSyntheticDemo = async () => {
    setErrorMessage(null);
    try {
      // A local raster and pre-labelled synthetic data only. Never invoke Gemini.
      addProject(await createSyntheticDemoProject(`demo-${Date.now()}`));
      setLeftPanelView('image');
      setActiveTab('list');
      setIsSidebarOpen(false);
    } catch (err) {
      setErrorMessage(`Could not load the offline demo: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const createDigitalTwin = async () => {
    if (!currentProject || currentProject.instruments.length === 0) return;
    setIsGeneratingTwin(true);
    setErrorMessage(null);
    try {
      const twinUrl = await generateDigitalTwin(currentProject.instruments);
      updateProject(currentProject.id, p => ({ ...p, digitalTwinUrl: twinUrl }));
      setLeftPanelView('twin');
    } catch (err) {
      setErrorMessage(`Digital twin generation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGeneratingTwin(false);
    }
  };

  const currentProjectId = currentProject?.id;

  const updateInstrument = useCallback((id: string, updates: Partial<Instrument>) => {
    if (!currentProjectId) return;
    editInstruments(currentProjectId, instruments =>
      instruments.map(inst => inst.id === id ? applyInstrumentUpdate(inst, updates) : inst));
  }, [currentProjectId, editInstruments]);

  const deleteInstrument = useCallback((id: string) => {
    if (!currentProjectId) return;
    editInstruments(currentProjectId, instruments => instruments.filter(inst => inst.id !== id));
  }, [currentProjectId, editInstruments]);

  const addInstrument = useCallback(() => {
    if (!currentProjectId) return;
    const prefix = 'manual-' + Date.now();
    editInstruments(currentProjectId, instruments => [
      ...instruments,
      // Manual entries still start as Unknown/low and require explicit review.
      normalizeInstrument({ description: 'Manually added instrument', equipmentType: 'Manual' },
        instruments.length, prefix),
    ]);
  }, [currentProjectId, editInstruments]);

  const exportBackup = (project: AnalysisProject) => {
    try {
      downloadText(serializeProject(project), `${project.name}.vision2dcs.json`, 'application/json');
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const importBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      assertProjectBackupBytes(file.size);
      addProject(parseProjectBackup(await file.text(), `proj-${Date.now()}`));
      setErrorMessage(null);
      setIsSidebarOpen(false);
    } catch (err) {
      setErrorMessage(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const commitRename = (project: AnalysisProject, value: string) => {
    const name = value.trim();
    if (name && name !== project.name) updateProject(project.id, p => ({ ...p, name }));
    setRenamingId(null);
  };

  const confirmDelete = (project: AnalysisProject) => {
    if (window.confirm(`Delete "${project.name}" from History? This cannot be undone.`)) removeProject(project.id);
  };

  return (
    <div className="nexus-app flex h-full min-h-0 flex-col bg-slate-950">
      <header className="nexus-app-header relative z-50 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Toggle project history" aria-expanded={isSidebarOpen} aria-controls="project-history-sidebar" className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="nexus-brand-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20"><img src="/nexus-x.svg" alt="" aria-hidden="true" className="h-8 w-8 object-contain" /></div>
            <div>
              <div className="flex items-center gap-3"><img src="/nexus-wordmark.svg" alt="NEXUS" className="h-9 w-24 object-contain" /><span aria-hidden="true" className="h-8 w-px bg-slate-600/80" /><div><h1 className="font-bold text-base leading-tight text-white sm:text-lg">Vision2DCS</h1><p className="text-[10px] font-bold uppercase tracking-widest text-cyan-200/70">Engineering concept studio</p></div></div>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:gap-4">
          <div className="nexus-view-switch flex flex-wrap rounded-lg bg-slate-800 p-1">
            <button onClick={() => setLeftPanelView('image')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${leftPanelView === 'image' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>P&ID View</button>
            <button onClick={() => setLeftPanelView('draft_hmi')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${leftPanelView === 'draft_hmi' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>HMI Topology</button>
            {currentProject?.digitalTwinUrl && <button onClick={() => setLeftPanelView('twin')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${leftPanelView === 'twin' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Digital Twin</button>}
          </div>
          <button 
            disabled={!currentProject || !aiAccessConfigured || isGeneratingTwin}
            onClick={createDigitalTwin}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${isGeneratingTwin ? 'bg-slate-800 text-slate-500 animate-pulse' : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/30'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            {isGeneratingTwin ? 'Imagining Twin...' : 'Generate Digital Twin'}
          </button>
          <div className="flex flex-wrap items-center gap-2" aria-label="AI access controls">
            {aiAccessConfigured ? (
              <>
                <span role="status" className="text-[10px] font-semibold text-emerald-300">AI token set for this tab</span>
                <button type="button" onClick={clearAiAccessToken} className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:border-cyan-400">Clear AI token</button>
              </>
            ) : (
              <>
                <label htmlFor="vision-ai-token" className="text-[10px] text-slate-300">AI access</label>
                <input id="vision-ai-token" type="password" autoComplete="off" spellCheck={false}
                  aria-label="Operator-issued AI access token" value={aiTokenDraft}
                  onChange={e => setAiTokenDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') applyAiAccessToken(); }}
                  placeholder="Operator access token" className="w-36 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-white" />
                <button type="button" onClick={applyAiAccessToken} className="rounded-lg border border-cyan-700 px-3 py-2 text-xs font-semibold text-cyan-200">Unlock AI</button>
              </>
            )}
          </div>
          <button type="button" onClick={loadSyntheticDemo} className="rounded-full border border-cyan-400/45 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/20" title="Explore a synthetic P&ID and manually editable tags without API calls">Load sample P&amp;ID</button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/jpeg,image/png,image/webp" />
          <button disabled={!aiAccessConfigured || isAnalyzing} title={!aiAccessConfigured ? 'Set an operator AI access token first' : 'Analyze a P&ID drawing'} onClick={() => fileInputRef.current?.click()} className="nexus-primary-action rounded-full px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40">
            Process Diagram
          </button>
        </div>
      </header>

      {storageWarning && (
        <div role="status" className="px-6 py-2 bg-amber-500/10 border-b border-amber-500/30 text-xs text-amber-300">{storageWarning}</div>
      )}

      {errorMessage && (
        <div role="alert" className="flex items-center justify-between gap-4 px-6 py-3 bg-red-500/10 border-b border-red-500/30 text-sm text-red-300">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} aria-label="Dismiss error" className="text-red-300/70 hover:text-red-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-auto lg:flex-row">
        <aside id="project-history-sidebar" aria-label="Project history" aria-hidden={!isSidebarOpen} inert={!isSidebarOpen} className={`absolute inset-y-0 left-0 w-80 bg-slate-900 border-r border-slate-800 z-[60] transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
           <div className="p-6 border-b border-slate-800 flex items-center">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">History</h2>
              <input type="file" ref={backupInputRef} onChange={importBackup} className="hidden" accept="application/json,.json" />
              <button onClick={() => backupInputRef.current?.click()} className="ml-auto mr-4 text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300">Import</button>
              <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
           </div>
           <div className="p-4 space-y-3 overflow-y-auto h-full pb-24 custom-scrollbar">
              {projects.length === 0 && <p className="text-xs text-slate-600 italic px-1">No saved projects yet.</p>}
              {projects.map(p => (
                <div key={p.id} onClick={() => { if (renamingId !== p.id) { selectProject(p.id); setIsSidebarOpen(false); } }} className={`group p-4 rounded-xl border cursor-pointer transition-all ${currentProject?.id === p.id ? 'bg-blue-600/10 border-blue-500/50' : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {renamingId === p.id ? (
                      <input
                        autoFocus
                        defaultValue={p.name}
                        aria-label="Project name"
                        onClick={e => e.stopPropagation()}
                        onBlur={e => commitRename(p, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitRename(p, e.currentTarget.value);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="flex-1 min-w-0 bg-slate-900 border border-blue-500/50 rounded px-2 py-0.5 text-sm font-bold text-white focus:outline-none"
                      />
                    ) : (
                      <h4 className="flex-1 min-w-0 text-sm font-bold text-white truncate">{p.name}</h4>
                    )}
                    <button onClick={e => { e.stopPropagation(); setRenamingId(p.id); }} aria-label={`Rename ${p.name}`} className="text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 13l6.232-6.232a2.5 2.5 0 113.536 3.536L12.536 16.536 8 17l.464-4.536z" /></svg>
                    </button>
                    <button onClick={e => { e.stopPropagation(); exportBackup(p); }} aria-label={`Export ${p.name} backup`} className="text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
                    <button onClick={e => { e.stopPropagation(); confirmDelete(p); }} aria-label={`Delete ${p.name}`} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                  <div className="flex justify-between text-[9px] font-bold text-slate-500"><span>{p.date}</span><span>{p.instruments.length} TAGS</span></div>
                </div>
              ))}
           </div>
        </aside>

        <div className="relative min-h-[320px] w-full shrink-0 overflow-hidden border-b border-slate-800 bg-slate-950 lg:min-h-0 lg:w-1/2 lg:shrink lg:border-b-0 lg:border-r">
          {leftPanelView === 'image' && (
            <div className="h-full relative overflow-auto custom-scrollbar">
              {currentProject ? (
                <div className="p-12 min-w-full min-h-full flex items-center justify-center">
                  <img src={currentProject.imageUrl} alt={`P&ID drawing: ${currentProject.name}`} className="max-w-full h-auto shadow-2xl rounded" style={{ transform: `scale(${zoom})` }} />
                </div>
              ) : <div className="h-full flex items-center justify-center text-slate-700 text-sm italic">No diagram loaded</div>}
              <div className="absolute top-4 left-4 flex bg-slate-900/80 rounded-full border border-slate-700 p-1">
                <button onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} className="w-8 h-8 flex items-center justify-center hover:bg-slate-700 rounded-full"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg></button>
                <div className="px-4 flex items-center text-[10px] font-bold text-slate-400">{Math.round(zoom * 100)}%</div>
                <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="w-8 h-8 flex items-center justify-center hover:bg-slate-700 rounded-full"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg></button>
              </div>
            </div>
          )}
          {leftPanelView === 'draft_hmi' && (
            <div className="h-full p-4">
              <HmiReactFlowView instruments={currentProject?.instruments || []} />
            </div>
          )}
          {leftPanelView === 'twin' && currentProject?.digitalTwinUrl && (
            <div className="h-full p-12 bg-slate-900 flex flex-col items-center justify-center gap-6 overflow-auto">
              <div className="relative group max-w-4xl">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                <img src={currentProject.digitalTwinUrl} alt={`Digital twin concept for ${currentProject.name}`} className="relative rounded-2xl shadow-2xl border border-white/10" />
                <div className="absolute bottom-6 left-6 right-6 p-4 bg-slate-900/80 backdrop-blur rounded-xl border border-white/10 flex justify-between items-center transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                  <div className="text-xs text-white">
                    <p className="font-bold">Digital Twin Concept</p>
                    <p className="text-[10px] text-slate-400">Generated from {currentProject.instruments.length} tags</p>
                  </div>
                  <a href={currentProject.digitalTwinUrl} download={`${currentProject.name}_Twin.png`} className="px-4 py-2 bg-blue-600 rounded-lg text-white text-[10px] font-bold uppercase">Download Render</a>
                </div>
              </div>
            </div>
          )}

          {isAnalyzing && <div className="absolute inset-0 bg-slate-950/80 backdrop-blur flex flex-col items-center justify-center z-[100]">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <h2 className="text-xl font-bold text-white tracking-tighter">Running Vision Engine...</h2>
          </div>}
        </div>

        <div className="nexus-engineering-panel z-20 flex min-h-[420px] w-full shrink-0 flex-col bg-slate-900 shadow-2xl lg:min-h-0 lg:w-1/2 lg:shrink">
           <div className="p-6 border-b border-slate-800 bg-slate-900/50">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-white font-bold">{currentProject?.name || 'Project Editor'}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">{currentProject?.instruments.length || 0} Extraction Nodes</p>
                </div>
                <div className="flex gap-2">
                  <button disabled={conceptExportDisabled} title={exportBlockers[0] ?? 'Unverified Siemens-style concept export'} onClick={() => { if (!conceptExportDisabled && currentProject) downloadSiemensCSV(currentProject.instruments, currentProject.name); }} className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">SIEMENS PCS7</button>
                  <button disabled={conceptExportDisabled} title={exportBlockers[0] ?? 'Unverified ABB-style concept export'} onClick={() => { if (!conceptExportDisabled && currentProject) downloadABBXML(currentProject.instruments, currentProject.name); }} className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">ABB 800xA</button>
                  <button
                    disabled={conceptExportDisabled}
                    title={exportBlockers[0] ?? 'Offline read-only human-reviewed NEXUS contract'}
                    onClick={() => {
                      if (!currentProject || conceptExportDisabled) return;
                      try {
                        const contract = buildReviewedTagMap(currentProject, new Date().toISOString());
                        downloadText(serializeNexusTagMapV1(contract), 'nexus-tag-map-v1.json', 'application/json');
                      } catch (error) {
                        setErrorMessage(error instanceof Error ? error.message : 'Tag-map export failed.');
                      }
                    }}
                    className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold text-cyan-400 hover:text-cyan-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    NEXUS TAG MAP
                  </button>
                </div>
              </div>

              {currentProject && exportBlockers.length > 0 && (
                <div role="status" className="mb-3 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                  Concept exports disabled: {exportBlockers[0]} Resolve critical tag and classification errors before download.
                </div>
              )}
              <div className="flex gap-6 border-b border-slate-800">
                 {['list', 'bom'].map(tab => (
                   <button key={tab} onClick={() => setActiveTab(tab as TabView)} className={`pb-2 text-[11px] font-bold uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-blue-400' : 'text-slate-500'}`}>
                      {tab === 'list' ? 'Tag Management' : 'Capex & BOM'}
                      {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />}
                   </button>
                 ))}
              </div>
           </div>

           <div className="flex-1 overflow-hidden flex flex-col p-6">
              <div className="flex-1 overflow-hidden mb-6">
                {activeTab === 'list' ? (
                  <>
                    <div className="mb-3 flex items-center justify-end gap-2">
                      <span className="mr-auto text-[10px] text-slate-500">Undo/redo restores values but revokes engineering review.</span>
                      <button type="button" aria-label="Undo instrument edit" onClick={() => currentProjectId && undoInstruments(currentProjectId)} disabled={!canUndo} className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed">Undo</button>
                      <button type="button" aria-label="Redo instrument edit" onClick={() => currentProjectId && redoInstruments(currentProjectId)} disabled={!canRedo} className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed">Redo</button>
                    </div>
                    <InstrumentTable instruments={currentProject?.instruments || []} onUpdate={updateInstrument} onDelete={deleteInstrument} onAdd={currentProject ? addInstrument : undefined} />
                  </>
                ) : <AuditBOM instruments={currentProject?.instruments || []} onExport={currentProject ? () => downloadBomCSV(currentProject.instruments, currentProject.name) : undefined} />}
              </div>

              {currentProject && (
                <div className="h-48 border-t border-slate-800 pt-4 overflow-hidden flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">OT-Sentinel Safety Audit</h4>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                    {sentinelAlerts.length === 0 ? (
                      <div className="text-[10px] text-emerald-500 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">No issues flagged by the limited tag/loop checks. Engineering review is still required; this is not ISA-5.1 certification.</div>
                    ) : sentinelAlerts.map((alert, i) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border text-[10px] leading-relaxed ${alert.severity === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : alert.severity === 'warning' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                         <span className="font-bold underline">{alert.tag}:</span>
                         <span>{alert.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;
