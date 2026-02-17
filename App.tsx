
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import InstrumentTable from './components/InstrumentTable';
import HmiReactFlowView from './components/HmiReactFlowView';
import AuditBOM from './components/AuditBOM';
import { Instrument, AnalysisProject, SentinelAlert } from './types';
import { analyzePIDImage, generateDigitalTwin } from './services/geminiService';
import { downloadSiemensCSV, downloadABBXML } from './services/exportService';
import { runSentinelAudit } from './services/otSentinelService';

type TabView = 'list' | 'hmi' | 'bom';
type LeftPanelView = 'image' | 'draft_hmi' | 'twin';

const App: React.FC = () => {
  const [projects, setProjects] = useState<AnalysisProject[]>([]);
  const [currentProject, setCurrentProject] = useState<AnalysisProject | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingTwin, setIsGeneratingTwin] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('list');
  const [leftPanelView, setLeftPanelView] = useState<LeftPanelView>('image');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('dcs_projects');
    if (saved) {
      try {
        setProjects(JSON.parse(saved));
      } catch (e) { console.error("Load error"); }
    }
  }, []);

  const saveProjects = (updatedProjects: AnalysisProject[]) => {
    setProjects(updatedProjects);
    localStorage.setItem('dcs_projects', JSON.stringify(updatedProjects));
  };

  const sentinelAlerts = useMemo(() => {
    if (!currentProject) return [];
    return runSentinelAudit(currentProject.instruments);
  }, [currentProject?.instruments]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(',')[1];
      const previewUrl = e.target?.result as string;
      
      setIsAnalyzing(true);
      try {
        const instruments = await analyzePIDImage(base64);
        const newProject: AnalysisProject = {
          id: `proj-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ""),
          date: new Date().toLocaleString(),
          imageUrl: previewUrl,
          instruments: instruments
        };
        setCurrentProject(newProject);
        saveProjects([newProject, ...projects]);
      } catch (err) {
        alert("Analysis failed. Please check your P&ID image quality.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const createDigitalTwin = async () => {
    if (!currentProject || currentProject.instruments.length === 0) return;
    setIsGeneratingTwin(true);
    try {
      const twinUrl = await generateDigitalTwin(currentProject.instruments);
      const updatedProject = { ...currentProject, digitalTwinUrl: twinUrl };
      setCurrentProject(updatedProject);
      saveProjects(projects.map(p => p.id === currentProject.id ? updatedProject : p));
      setLeftPanelView('twin');
    } catch (err) {
      alert("Conceptual generation failed.");
    } finally {
      setIsGeneratingTwin(false);
    }
  };

  const updateInstrument = useCallback((id: string, updates: Partial<Instrument>) => {
    if (!currentProject) return;
    const updatedProject = {
      ...currentProject,
      instruments: currentProject.instruments.map(inst => inst.id === id ? { ...inst, ...updates } : inst)
    };
    setCurrentProject(updatedProject);
    saveProjects(projects.map(p => p.id === currentProject.id ? updatedProject : p));
  }, [currentProject, projects]);

  const deleteInstrument = useCallback((id: string) => {
    if (!currentProject) return;
    const updatedProject = {
      ...currentProject,
      instruments: currentProject.instruments.filter(inst => inst.id !== id)
    };
    setCurrentProject(updatedProject);
    saveProjects(projects.map(p => p.id === currentProject.id ? updatedProject : p));
  }, [currentProject, projects]);

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
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
          <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-full text-sm font-semibold shadow-lg transition-transform active:scale-95">
            Process Diagram
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className={`absolute inset-y-0 left-0 w-80 bg-slate-900 border-r border-slate-800 z-[60] transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
           <div className="p-6 border-b border-slate-800 flex justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">History</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
           </div>
           <div className="p-4 space-y-3 overflow-y-auto h-full pb-24 custom-scrollbar">
              {projects.map(p => (
                <div key={p.id} onClick={() => { setCurrentProject(p); setIsSidebarOpen(false); }} className={`p-4 rounded-xl border cursor-pointer transition-all ${currentProject?.id === p.id ? 'bg-blue-600/10 border-blue-500/50' : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}>
                  <h4 className="text-sm font-bold text-white mb-1 truncate">{p.name}</h4>
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
                  <img src={currentProject.imageUrl} className="max-w-none shadow-2xl rounded" style={{ transform: `scale(${zoom})` }} />
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
                <img src={currentProject.digitalTwinUrl} className="relative rounded-2xl shadow-2xl border border-white/10" />
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
