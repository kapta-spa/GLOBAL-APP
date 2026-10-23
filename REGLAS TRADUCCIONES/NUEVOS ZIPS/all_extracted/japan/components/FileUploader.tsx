
import React from 'react';
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
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        {selectedFile && (
          <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
            READY
          </span>
        )}
      </div>
      <motion.div 
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`relative border border-dashed rounded-2xl p-5 transition-all cursor-pointer group overflow-hidden
          ${selectedFile 
            ? 'border-emerald-300 bg-emerald-50/40 shadow-sm shadow-emerald-100/50' 
            : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-slate-50/50 hover:shadow-lg hover:shadow-indigo-500/5'}`}
        onClick={() => document.getElementById(`input-${label}`)?.click()}
      >
        <input 
          id={`input-${label}`}
          type="file" 
          accept={accept} 
          className="hidden" 
          onChange={handleChange}
        />
        
        <div className="flex flex-col items-center justify-center gap-3 text-center relative z-10">
          <AnimatePresence mode="wait">
            {selectedFile ? (
              <motion.div 
                key="selected"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center"
              >
                <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl mb-2">
                  <CheckCircle size={20} />
                </div>
                <p className="text-[13px] font-bold text-slate-700 truncate max-w-[180px]">
                  {selectedFile.name}
                </p>
                <button 
                  onClick={clearFile}
                  className="mt-2 text-[11px] font-bold text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors px-2 py-1 hover:bg-red-50 rounded-lg"
                >
                  <X size={12} /> REMOVE
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center"
              >
                <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl border border-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-500 group-hover:border-indigo-100 transition-all mb-3">
                  {icon === 'file' ? <UploadCloud size={22} /> : <ImageIcon size={22} />}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-slate-700">
                    {isImage ? 'Select Image' : 'Select Document'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">
                    {isImage ? 'JPG, PNG • Ctrl+V to paste' : 'Word Document (.docx)'}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Decorative corner element */}
        {!selectedFile && (
          <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default FileUploader;
