
import React, { useState, useCallback, useRef, useMemo } from 'react';
import InstrumentTable from './components/InstrumentTable';
import HmiReactFlowView from './components/HmiReactFlowView';
import AuditBOM from './components/AuditBOM';
import { Instrument, AnalysisProject } from './types';
import { analyzePIDImage, generateDigitalTwin } from './services/geminiService';
import { downloadSiemensCSV, downloadABBXML } from './services/exportService';
import { runSentinelAudit } from './services/otSentinelService';
import { prepareImage, validateImageFile } from './services/imageUpload';
import { useProjects } from './hooks/useProjects';

type TabView = 'list' | 'hmi' | 'bom';
type LeftPanelView = 'image' | 'draft_hmi' | 'twin';

const App: React.FC = () => {
  const { projects, currentProject, selectProject, addProject, updateProject, removeProject, storageWarning } = useProjects();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingTwin, setIsGeneratingTwin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('list');
  const [leftPanelView, setLeftPanelView] = useState<LeftPanelView>('image');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sentinelAlerts = useMemo(() => {
    if (!currentProject) return [];
    return runSentinelAudit(currentProject.instruments);
  }, [currentProject?.instruments]);

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
    updateProject(currentProjectId, p => ({
      ...p,
      instruments: p.instruments.map(inst => inst.id === id ? { ...inst, ...updates } : inst)
    }));
  }, [currentProjectId, updateProject]);

  const deleteInstrument = useCallback((id: string) => {
    if (!currentProjectId) return;
    updateProject(currentProjectId, p => ({
      ...p,
      instruments: p.instruments.filter(inst => inst.id !== id)
    }));
  }, [currentProjectId, updateProject]);

  const commitRename = (project: AnalysisProject, value: string) => {
    const name = value.trim();
    if (name && name !== project.name) updateProject(project.id, p => ({ ...p, name }));
    setRenamingId(null);
  };

  const confirmDelete = (project: AnalysisProject) => {
    if (window.confirm(`Delete "${project.name}" from History? This cannot be undone.`)) removeProject(project.id);
  };

  return (
    <div className="flex h-full flex-col bg-slate-950">
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight text-white">Vision2DCS</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">ISA-5.1 & HP-HMI Core</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-slate-800 p-1 rounded-lg">
            <button onClick={() => setLeftPanelView('image')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${leftPanelView === 'image' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>P&ID View</button>
            <button onClick={() => setLeftPanelView('draft_hmi')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${leftPanelView === 'draft_hmi' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>HMI Topology</button>
            {currentProject?.digitalTwinUrl && <button onClick={() => setLeftPanelView('twin')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${leftPanelView === 'twin' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Digital Twin</button>}
          </div>
          <button 
            disabled={!currentProject || isGeneratingTwin}
            onClick={createDigitalTwin}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${isGeneratingTwin ? 'bg-slate-800 text-slate-500 animate-pulse' : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/30'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            {isGeneratingTwin ? 'Imagining Twin...' : 'Generate Digital Twin'}
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/jpeg,image/png,image/webp" />
          <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-full text-sm font-semibold shadow-lg transition-transform active:scale-95">
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

      <div className="flex-1 flex overflow-hidden">
        <aside className={`absolute inset-y-0 left-0 w-80 bg-slate-900 border-r border-slate-800 z-[60] transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
           <div className="p-6 border-b border-slate-800 flex justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">History</h2>
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
                    <button onClick={e => { e.stopPropagation(); confirmDelete(p); }} aria-label={`Delete ${p.name}`} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                  <div className="flex justify-between text-[9px] font-bold text-slate-500"><span>{p.date}</span><span>{p.instruments.length} TAGS</span></div>
                </div>
              ))}
           </div>
        </aside>

        <div className="w-1/2 bg-slate-950 border-r border-slate-800 overflow-hidden relative">
          {leftPanelView === 'image' && (
            <div className="h-full relative overflow-auto custom-scrollbar">
              {currentProject ? (
                <div className="p-12 min-w-full min-h-full flex items-center justify-center">
                  <img src={currentProject.imageUrl} alt={`P&ID drawing: ${currentProject.name}`} className="max-w-none shadow-2xl rounded" style={{ transform: `scale(${zoom})` }} />
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

        <div className="w-1/2 flex flex-col bg-slate-900 shadow-2xl z-20">
           <div className="p-6 border-b border-slate-800 bg-slate-900/50">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-white font-bold">{currentProject?.name || 'Project Editor'}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">{currentProject?.instruments.length || 0} Extraction Nodes</p>
                </div>
                <div className="flex gap-2">
                  <button disabled={!currentProject} onClick={() => downloadSiemensCSV(currentProject!.instruments, currentProject!.name)} className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-colors">SIEMENS PCS7</button>
                  <button disabled={!currentProject} onClick={() => downloadABBXML(currentProject!.instruments, currentProject!.name)} className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-colors">ABB 800xA</button>
                </div>
              </div>

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
                  <InstrumentTable instruments={currentProject?.instruments || []} onUpdate={updateInstrument} onDelete={deleteInstrument} />
                ) : <AuditBOM instruments={currentProject?.instruments || []} />}
              </div>

              {currentProject && (
                <div className="h-48 border-t border-slate-800 pt-4 overflow-hidden flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">OT-Sentinel Safety Audit</h4>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                    {sentinelAlerts.length === 0 ? (
                      <div className="text-[10px] text-emerald-500 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">All loops compliant with ISA-5.1 standards.</div>
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
