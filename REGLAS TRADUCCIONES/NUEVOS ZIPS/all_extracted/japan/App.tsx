
import React, { useState, useEffect } from 'react';
import { 
  FileText, Cpu, Download, Loader2, 
  CheckCircle2, XCircle, AlertTriangle, 
  ShieldCheck, ArrowRight, RefreshCw, 
  Zap, Settings, HelpCircle, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FileUploader from './components/FileUploader';
import DataPreview from './components/DataPreview';
import { extractDataFromLicense } from './services/geminiService';
import { generateFilledDoc, optimizeImage } from './services/docService';
import { AppState, ProcessStatus } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    templateFile: null,
    frontImage: null,
    backImage: null,
    status: ProcessStatus.IDLE,
    extractedData: null,
    error: null,
  });

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type });
            setState(prev => {
              if (!prev.frontImage) return { ...prev, frontImage: file, error: null };
              else if (!prev.backImage) return { ...prev, backImage: file, error: null };
              return prev;
            });
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleProcess = async () => {
    if (!state.templateFile || !state.frontImage || !state.backImage) {
      setState(prev => ({ ...prev, error: "Missing required files." }));
      return;
    }
    setState(prev => ({ ...prev, status: ProcessStatus.PROCESSING, error: null }));
    try {
      // Optimize images BEFORE sending to AI to speed up upload and analysis
      const optimizedFrontB64 = await optimizeImage(state.frontImage);
      const optimizedBackB64 = await optimizeImage(state.backImage);
      
      // Remove the prefix 'data:image/jpeg;base64,' for the AI service
      const cleanFront = optimizedFrontB64.split(',')[1];
      const cleanBack = optimizedBackB64.split(',')[1];

      const data = await extractDataFromLicense(cleanFront, cleanBack);
      setState(prev => ({ ...prev, status: ProcessStatus.REVIEW, extractedData: data }));
    } catch (err: any) {
      setState(prev => ({ ...prev, status: ProcessStatus.ERROR, error: err.message }));
    }
  };

  const handleFinalize = async () => {
    if (!state.templateFile || !state.extractedData || !state.frontImage || !state.backImage) return;
    setState(prev => ({ ...prev, status: ProcessStatus.PROCESSING }));
    try {
      const frontBase64 = await optimizeImage(state.frontImage);
      const backBase64 = await optimizeImage(state.backImage);
      const blob = await generateFilledDoc(state.templateFile, state.extractedData, frontBase64, backBase64);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Filled_${state.extractedData.surname || 'Document'}.docx`;
      a.click();
      setState(prev => ({ ...prev, status: ProcessStatus.COMPLETED }));
    } catch (err: any) {
      setState(prev => ({ ...prev, status: ProcessStatus.REVIEW, error: err.message }));
    }
  };

  const steps = [
    { label: 'Connect Files', icon: Layers, status: state.templateFile && state.frontImage && state.backImage ? 'complete' : 'pending' },
    { label: 'AI Analysis', icon: Cpu, status: state.status === ProcessStatus.PROCESSING ? 'current' : (state.extractedData ? 'complete' : 'pending') },
    { label: 'Quality Check', icon: ShieldCheck, status: state.status === ProcessStatus.REVIEW ? 'current' : (state.status === ProcessStatus.COMPLETED ? 'complete' : 'pending') },
    { label: 'Export Word', icon: Download, status: state.status === ProcessStatus.COMPLETED ? 'complete' : 'pending' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900 bg-dot-pattern">
      {/* Sidebar - Desktop Only */}
      <aside className="w-72 bg-white border-r border-slate-200 p-8 hidden lg:flex flex-col gap-10 sticky top-0 h-screen">
        <header className="flex items-center gap-3">
          <div className="bg-indigo-600 w-10 h-10 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center">
            <FileText className="text-white" size={20} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-black text-slate-900 leading-none">DocuFill AI</h1>
            <span className="text-[10px] font-bold text-slate-400 mt-1 tracking-widest uppercase">Expert System</span>
          </div>
        </header>

        <nav className="flex-1 space-y-6">
          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Pipeline Status</p>
            <div className="space-y-1">
              {steps.map((step, idx) => (
                <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${step.status === 'current' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>
                  <step.icon size={18} className={step.status === 'complete' ? 'text-emerald-500' : ''} />
                  <span className={`text-[13px] font-bold ${step.status === 'current' ? 'text-indigo-600' : ''}`}>
                    {step.label}
                  </span>
                  {step.status === 'complete' && <CheckCircle2 size={14} className="ml-auto text-emerald-500" />}
                </div>
              ))}
            </div>
          </div>
        </nav>

        <footer className="pt-6 border-t border-slate-100 flex flex-col gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0">
               <img src="https://picsum.photos/seed/user/100" referrerPolicy="no-referrer" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-800 truncate">Professional</span>
              <span className="text-[10px] text-slate-400 font-medium">Japanese License</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-slate-400 px-1">
            <Settings size={16} className="hover:text-slate-600 cursor-pointer transition-colors" />
            <HelpCircle size={16} className="hover:text-slate-600 cursor-pointer transition-colors" />
            <Zap size={16} className="hover:text-indigo-600 cursor-pointer transition-colors" />
          </div>
        </footer>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 lg:p-16 max-w-6xl mx-auto w-full overflow-y-auto">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center">
              <FileText className="text-white" size={16} />
            </div>
            <h1 className="text-lg font-black text-slate-900">DocuFill AI</h1>
          </div>
          <button className="p-2 bg-white rounded-lg border border-slate-200"><Settings size={18} /></button>
        </header>

        <AnimatePresence mode="wait">
          {state.error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 bg-red-50 text-red-700 p-6 rounded-[2rem] border border-red-100 flex items-start gap-4 shadow-xl shadow-red-500/5 overflow-hidden"
            >
              <div className="p-2 bg-white rounded-xl text-red-500 shadow-sm border border-red-100">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black uppercase tracking-wider mb-1">System Error</h4>
                <p className="text-xs font-medium opacity-80 leading-relaxed">{state.error}</p>
              </div>
              <button 
                onClick={() => setState(p => ({...p, error: null}))}
                className="p-2 hover:bg-red-100 rounded-xl transition-colors"
                aria-label="Close error"
              >
                <XCircle size={20} />
              </button>
            </motion.div>
          )}

          {(state.status === ProcessStatus.IDLE || state.status === ProcessStatus.ERROR) && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="space-y-12"
            >
              <div className="max-w-2xl">
                <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                  Automate Japanese <br/>
                  <span className="text-indigo-600">License Documents</span>
                </h2>
                <p className="text-slate-500 mt-6 text-lg font-medium leading-relaxed">
                  The AI-powered engine for fast, accurate license translation and document preparation.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">01</div>
                    <h3 className="font-black text-slate-400 text-[11px] uppercase tracking-[0.2em]">Templates</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <FileUploader label="Output Template (.docx)" accept=".docx" selectedFile={state.templateFile} onFileSelect={(f) => setState(p => ({...p, templateFile: f}))} />
                  </div>
                </section>

                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">02</div>
                    <h3 className="font-black text-slate-400 text-[11px] uppercase tracking-[0.2em]">Visual Evidence</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FileUploader label="Front Photo" accept="image/*" icon="image" selectedFile={state.frontImage} onFileSelect={(f) => setState(p => ({...p, frontImage: f}))} />
                    <FileUploader label="Back Photo" accept="image/*" icon="image" selectedFile={state.backImage} onFileSelect={(f) => setState(p => ({...p, backImage: f}))} />
                  </div>
                </section>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02, backgroundColor: '#4f46e5' }}
                whileTap={{ scale: 0.98 }}
                onClick={handleProcess}
                disabled={!state.templateFile || !state.frontImage || !state.backImage || state.status === ProcessStatus.PROCESSING}
                className="w-full bg-slate-900 text-white py-8 rounded-3xl font-black text-xl hover:shadow-2xl hover:shadow-indigo-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-4 relative overflow-hidden group shadow-xl"
              >
                <Cpu size={28} className="transition-transform group-hover:rotate-12" /> 
                EXECUTE AI ANALYSIS
                <ArrowRight size={24} className="opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0" />
              </motion.button>
            </motion.div>
          )}

          {state.status === ProcessStatus.PROCESSING && (
            <motion.div 
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="bg-white p-12 lg:p-24 rounded-[3rem] text-center space-y-8 max-w-2xl mx-auto shadow-2xl border border-slate-100 flex flex-col items-center justify-center"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-100 blur-2xl rounded-full animate-pulse opacity-50"></div>
                <Loader2 className="relative animate-spin text-indigo-600" size={80} />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">AI Engine Running</h2>
                <div className="space-y-2">
                  <p className="text-slate-500 font-medium">Translating license data and extracting features...</p>
                  <div className="max-w-[12rem] mx-auto h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      animate={{ x: [-100, 200] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="w-24 h-full bg-indigo-600 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {state.status === ProcessStatus.REVIEW && state.extractedData && (
            <motion.div 
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-10"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Extraction Pipeline Output</h2>
                  <p className="text-slate-500 font-medium mt-1 uppercase text-[11px] tracking-widest">Verification required before final document assembly</p>
                </div>
                <button onClick={() => setState(p => ({...p, status: ProcessStatus.IDLE}))} className="flex items-center gap-2 text-xs font-black text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">
                  <RefreshCw size={14} /> Restart
                </button>
              </div>

              <DataPreview data={state.extractedData} onChange={(d) => setState(p => ({...p, extractedData: d}))} />
              
              <div className="flex flex-col sm:flex-row gap-4">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleFinalize} 
                  className="flex-1 bg-emerald-600 text-white py-6 rounded-2xl font-black text-xl hover:bg-emerald-700 shadow-xl shadow-emerald-500/10 flex items-center justify-center gap-4 transition-all"
                >
                  <Download size={28} /> GENERATE WORD FILE
                </motion.button>
              </div>
            </motion.div>
          )}

          {state.status === ProcessStatus.COMPLETED && (
            <motion.div 
              key="completed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-12 lg:p-20 rounded-[4rem] text-center space-y-10 max-w-2xl mx-auto shadow-2xl border border-slate-50 flex flex-col items-center justify-center"
            >
              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shadow-inner">
                <CheckCircle2 size={48} />
              </div>
              <div className="space-y-4">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">Document Assembly <br/> Successful</h2>
                <p className="text-slate-500 font-medium lg:px-12 leading-relaxed">
                  Your professional Japanese license document has been generated and downloaded. 
                  The AI has verified all fields.
                </p>
              </div>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => window.location.reload()} 
                className="w-full max-w-xs py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-slate-900/10 hover:shadow-2xl transition-all"
              >
                PROCESS NEW LICENSE
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default App;
