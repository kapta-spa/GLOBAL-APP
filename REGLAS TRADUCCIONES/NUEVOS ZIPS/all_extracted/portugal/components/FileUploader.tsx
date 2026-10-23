
import React from 'react';
import { FileUp, Image as ImageIcon, CheckCircle, X, ClipboardPaste } from 'lucide-react';
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
    <div className="flex flex-col gap-2.5">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">{label}</span>
      <motion.div 
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`relative border-2 border-dashed rounded-3xl p-8 transition-all cursor-pointer group overflow-hidden
          ${selectedFile 
            ? 'border-emerald-200 bg-emerald-50/50' 
            : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/30 shadow-sm hover:shadow-md'}`}
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center gap-3 text-center"
            >
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div className="flex flex-col items-center">
                <p className="text-sm font-bold text-emerald-900 truncate max-w-[240px]">
                  {selectedFile.name}
                </p>
                <button 
                  onClick={clearFile}
                  className="mt-3 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
                >
                  <X size={14} /> Remove File
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-4 text-center py-2"
            >
              <div className="p-4 bg-indigo-50 text-indigo-500 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                {icon === 'file' ? <FileUp size={28} /> : <ImageIcon size={28} />}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {isImage ? 'Upload or Paste License' : 'Drop Word Template'}
                </p>
                <p className="text-xs text-slate-400 mt-1.5 font-medium">
                  {isImage ? 'JPG, PNG up to 10MB' : '.docx format required'}
                </p>
              </div>
              {isImage && (
                <div className="flex items-center gap-1.5 text-[10px] text-indigo-500/80 font-bold uppercase tracking-wider bg-white px-3 py-1 rounded-full shadow-sm">
                  <ClipboardPaste size={12} /> Clipboard Support
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
