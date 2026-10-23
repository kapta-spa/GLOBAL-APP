
import React, { useState } from 'react';
import { FileUp, Image as ImageIcon, CheckCircle, X, ClipboardPaste, UploadCloud } from 'lucide-react';
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
  const [isDragOver, setIsDragOver] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => setIsDragOver(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const isImage = accept.includes('image');

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">{label}</span>
      <motion.div 
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative border-2 rounded-3xl p-8 transition-all cursor-pointer group overflow-hidden
          ${selectedFile 
            ? 'border-emerald-500 bg-emerald-50/50' 
            : isDragOver 
              ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-50' 
              : 'border-slate-200 border-dashed bg-white hover:border-indigo-400 hover:shadow-lg'}`}
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
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center gap-3 text-center"
            >
              <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                <CheckCircle size={24} />
              </div>
              <div className="flex flex-col items-center">
                <p className="text-sm font-black text-emerald-900 truncate max-w-[200px] font-mono">
                  {selectedFile.name}
                </p>
                <button 
                  onClick={clearFile}
                  className="mt-2 px-3 py-1 bg-white border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-600 hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                >
                  <X size={12} /> CAMBIAR
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-4 text-center"
            >
              <div className={`p-4 rounded-2xl transition-all ${isDragOver ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                {isDragOver ? <UploadCloud size={32} /> : icon === 'file' ? <FileUp size={32} /> : <ImageIcon size={32} />}
              </div>
              <div>
                <p className="text-sm font-black text-slate-700 tracking-tight">
                  {isDragOver ? '¡Suelta para subir!' : isImage ? 'Selecciona o Arrastra' : 'Subir Plantilla .docx'}
                </p>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  {isImage ? 'JPG, PNG o pega (Ctrl+V)' : 'Documento Word formateado'}
                </p>
              </div>
              {isImage && (
                <div className="flex items-center gap-1.5 text-[9px] text-indigo-400 font-black uppercase tracking-widest bg-indigo-50/50 px-3 py-1 rounded-full border border-indigo-50">
                  <ClipboardPaste size={10} /> Clipboard
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default FileUploader;
