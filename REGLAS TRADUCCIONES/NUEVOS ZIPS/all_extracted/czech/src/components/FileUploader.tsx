
import React, { useState, useEffect, useRef } from 'react';
import { FileUp, Image as ImageIcon, CheckCircle, X, ClipboardPaste, RefreshCw, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isImage = accept.includes('image') || (selectedFile?.type.startsWith('image/') ?? false);

  useEffect(() => {
    if (selectedFile && isImage) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile, isImage]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between ml-1 mr-1">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</span>
        {previewUrl && (
          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50 flex items-center gap-1">
            <Eye size={10} /> Vista previa lista
          </span>
        )}
      </div>

      <div 
        className={`relative border-2 border-dashed rounded-3xl transition-all duration-300 cursor-pointer group overflow-hidden
          ${isDragging 
            ? 'border-indigo-500 bg-indigo-50/70 scale-[1.01]' 
            : selectedFile 
              ? 'border-emerald-300 bg-white shadow-sm hover:border-emerald-400' 
              : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-slate-50/50'
          } ${selectedFile && previewUrl ? 'p-3' : 'p-8'}`}
        onClick={triggerUpload}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          accept={accept} 
          className="hidden" 
          onChange={handleChange}
        />
        
        <div className="flex flex-col items-center justify-center text-center">
          <AnimatePresence mode="wait">
            {selectedFile ? (
              <motion.div 
                key="selected"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="w-full flex flex-col items-center"
              >
                {previewUrl ? (
                  <div className="w-full flex flex-col gap-2.5">
                    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-950/5 group/preview shadow-sm">
                      <img 
                        src={previewUrl} 
                        alt={`Vista previa ${label}`} 
                        className="w-full h-44 object-contain rounded-2xl bg-slate-900/5"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] opacity-0 group-hover/preview:opacity-100 transition-all flex items-center justify-center gap-2">
                        <span className="text-xs font-bold text-white bg-slate-900/80 px-3 py-1.5 rounded-xl border border-white/20 shadow-lg flex items-center gap-1.5">
                          <RefreshCw size={12} /> Clic para cambiar foto
                        </span>
                      </div>
                      <div className="absolute top-2.5 right-2.5 bg-emerald-500 text-white p-1 rounded-full shadow-md">
                        <CheckCircle size={14} />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between w-full px-1.5 py-0.5">
                      <p className="text-xs font-semibold text-slate-700 truncate max-w-[190px]" title={selectedFile.name}>
                        {selectedFile.name}
                      </p>
                      <button 
                        type="button"
                        onClick={clearFile}
                        className="text-[10px] uppercase font-black tracking-widest text-red-500 hover:text-red-700 transition-colors flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg shadow-xs"
                      >
                        <X size={11} /> Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm border border-emerald-100 mb-2">
                      <CheckCircle size={32} />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-sm font-bold text-emerald-900 truncate max-w-[200px]">
                        {selectedFile.name}
                      </p>
                      <button 
                        type="button"
                        onClick={clearFile}
                        className="text-[10px] uppercase font-black tracking-widest text-red-400 hover:text-red-600 transition-colors flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-100 rounded-lg mt-2 shadow-xs"
                      >
                        <X size={10} /> Quitar
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-2"
              >
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-100 group-hover:scale-110 transition-all shadow-sm mb-3">
                  {icon === 'file' ? <FileUp size={28} /> : <ImageIcon size={28} />}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800 tracking-tight">
                    {isImage ? 'Arrastra o pega imagen' : 'Selecciona archivo Word'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">
                    {isImage ? 'JPG, PNG • SOPORTE CTRL+V' : '.DOCX • PLANTILLA BASE'}
                  </p>
                </div>
                {isImage && (
                  <div className="mt-4 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full flex items-center gap-2">
                    <ClipboardPaste size={10} className="text-indigo-400" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Portapapeles OK</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
