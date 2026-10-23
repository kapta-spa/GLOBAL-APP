
import React from 'react';
import { FileUp, Image as ImageIcon, CheckCircle, X, ClipboardPaste, ArrowUpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FileUploaderProps {
  label: string;
  accept: string;
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  icon?: 'file' | 'image';
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  label, 
  accept, 
  onFileSelect, 
  selectedFile,
  icon = 'file'
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
  };

  const isImage = accept.includes('image');

  return (
    <div className="flex flex-col gap-3">
      {label && <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</span>}
      <div 
        className={`relative group h-48 rounded-[2rem] border-2 border-dashed transition-all cursor-pointer overflow-hidden
          ${selectedFile 
            ? 'border-emerald-500 bg-emerald-50/30' 
            : 'border-slate-200 bg-white hover:border-indigo-500 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1'}`}
        onClick={() => document.getElementById(`input-${label}`)?.click()}
      >
        <input 
          id={`input-${label}`}
          type="file" 
          accept={accept} 
          className="hidden" 
          onChange={handleChange}
        />
        
        <AnimatePresence mode="wait">
          {selectedFile ? (
            <motion.div 
              key="selected"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 mb-4">
                <CheckCircle size={32} />
              </div>
              <p className="text-sm font-black text-emerald-900 truncate max-w-full px-4">
                {selectedFile.name}
              </p>
              <button 
                onClick={clearFile}
                className="mt-3 text-[10px] font-black text-emerald-600 hover:text-red-500 flex items-center gap-1.5 transition-colors uppercase tracking-widest"
              >
                <X size={10} /> Quitar Archivo
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all mb-4">
                {icon === 'file' ? <FileUp size={28} /> : <ImageIcon size={28} />}
              </div>
              <div>
                <p className="text-[13px] font-black text-slate-800 leading-tight">
                  {isImage ? 'Añadir Foto' : 'Cargar Plantilla'}
                </p>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">
                  {isImage ? 'JPG / PNG • MAX 10MB' : 'Word XML (.docx)'}
                </p>
              </div>
              
              {isImage && (
                <div className="mt-4 px-3 py-1 bg-indigo-50 rounded-lg text-[9px] text-indigo-400 font-black uppercase tracking-tighter flex items-center gap-1.5 border border-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ClipboardPaste size={10} /> Pegar (Ctrl+V) disponible
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Decorative corner element */}
        <div className="absolute top-0 right-0 w-12 h-12 flex items-center justify-center text-slate-300 group-hover:text-indigo-300 transition-colors">
          <ArrowUpCircle size={16} className="-rotate-45" />
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
