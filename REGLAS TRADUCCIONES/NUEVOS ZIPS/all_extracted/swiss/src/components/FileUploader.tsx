
import React, { useState, useEffect, useRef } from 'react';
import { 
  FileUp, 
  Image as ImageIcon, 
  CheckCircle, 
  X, 
  ClipboardPaste, 
  FileText, 
  Eye, 
  RefreshCw, 
  Maximize2 
} from 'lucide-react';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showFullModal, setShowFullModal] = useState(false);

  const isImage = accept.includes('image');

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    if (selectedFile.type.startsWith('image/') || isImage) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile, isImage]);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowFullModal(false);
    };
    if (showFullModal) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showFullModal]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
    if (inputRef.current) {
      inputRef.current.value = '';
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between ml-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</span>
          {selectedFile && isImage && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Cargada ({formatFileSize(selectedFile.size)})
            </span>
          )}
        </div>

        <div 
          className={`relative border-2 border-dashed rounded-3xl transition-all duration-300 cursor-pointer group overflow-hidden
            ${selectedFile && previewUrl 
              ? 'p-3 border-emerald-300 bg-emerald-50/20 shadow-sm hover:border-emerald-400' 
              : selectedFile 
                ? 'p-8 border-emerald-200 bg-emerald-50/50 shadow-inner' 
                : isDragging 
                  ? 'p-8 border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
                  : 'p-8 border-slate-200 bg-white hover:border-indigo-400 hover:bg-slate-50/50'}`}
          onClick={() => {
            if (!selectedFile || !previewUrl) {
              inputRef.current?.click();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input 
            ref={inputRef}
            id={`input-${label.replace(/\s+/g, '-').toLowerCase()}`}
            type="file" 
            accept={accept} 
            className="hidden" 
            onChange={handleChange}
          />
          
          <AnimatePresence mode="wait">
            {selectedFile && previewUrl ? (
              // IMAGE PREVIEW IN THE UPLOAD BOX
              <motion.div 
                key="image-preview"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="relative w-full"
              >
                {/* Image display container */}
                <div className="relative w-full h-64 sm:h-72 bg-slate-950/5 rounded-2xl overflow-hidden border border-slate-200/80 flex items-center justify-center group/preview">
                  <img 
                    src={previewUrl} 
                    alt={selectedFile.name} 
                    className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover/preview:scale-[1.02]"
                  />

                  {/* Top bar with status and action buttons */}
                  <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/95 backdrop-blur-md text-emerald-700 font-bold text-[11px] rounded-xl shadow-sm border border-emerald-100">
                      <CheckCircle size={13} className="text-emerald-500" />
                      Vista Previa
                    </span>

                    <div className="flex items-center gap-1.5 pointer-events-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFullModal(true);
                        }}
                        title="Ver en pantalla completa"
                        className="p-2 bg-white/95 hover:bg-white text-slate-700 hover:text-indigo-600 rounded-xl shadow-sm border border-slate-200 transition-all hover:scale-105"
                      >
                        <Maximize2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={clearFile}
                        title="Quitar imagen"
                        className="p-2 bg-white/95 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl shadow-sm border border-slate-200 transition-all hover:scale-105"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Bottom bar with filename and replace button */}
                  <div className="absolute bottom-2.5 inset-x-2.5 bg-slate-900/85 backdrop-blur-md text-white px-3.5 py-2 rounded-xl flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <ImageIcon size={13} className="text-indigo-300 shrink-0" />
                      <p className="text-[11px] font-medium text-slate-100 truncate">
                        {selectedFile.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        inputRef.current?.click();
                      }}
                      className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white font-bold text-[10px] rounded-lg transition-colors uppercase tracking-wider"
                    >
                      <RefreshCw size={10} /> Cambiar
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : selectedFile ? (
              // NON-IMAGE FILE (e.g. DOCX TEMPLATE)
              <motion.div 
                key="file-selected"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center text-center py-4"
              >
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm border border-emerald-100 mb-2">
                  <FileText size={32} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-sm font-bold text-emerald-900 truncate max-w-[220px]">
                    {selectedFile.name}
                  </p>
                  <span className="text-[10px] font-bold text-slate-400">
                    {formatFileSize(selectedFile.size)}
                  </span>
                  <button 
                    type="button"
                    onClick={clearFile}
                    className="text-[10px] uppercase font-black tracking-widest text-red-400 hover:text-red-600 transition-colors flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-100 rounded-lg mt-2 shadow-sm"
                  >
                    <X size={10} /> Quitar
                  </button>
                </div>
              </motion.div>
            ) : (
              // EMPTY DROP ZONE
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center text-center py-6"
              >
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-100 group-hover:scale-110 transition-all shadow-sm mb-3">
                  {icon === 'file' ? <FileUp size={28} /> : <ImageIcon size={28} />}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800 tracking-tight">
                    {isImage ? 'Arrastra o pega imagen de la licencia' : 'Selecciona archivo Word'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">
                    {isImage ? 'JPG, PNG • SOPORTE CTRL+V' : '.DOCX • PLANTILLA BASE'}
                  </p>
                </div>
                {isImage && (
                  <div className="mt-4 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full flex items-center gap-2">
                    <ClipboardPaste size={11} className="text-indigo-400" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Portapapeles OK</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* FULLSCREEN PREVIEW MODAL */}
      {showFullModal && previewUrl && selectedFile && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setShowFullModal(false)}
        >
          <div 
            className="relative max-w-4xl w-full max-h-[92vh] bg-white rounded-3xl p-5 shadow-2xl overflow-hidden flex flex-col border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ImageIcon size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 truncate max-w-[280px] sm:max-w-md">
                    {label} — {selectedFile.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Vista en tamaño completo ({formatFileSize(selectedFile.size)})
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowFullModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                title="Cerrar (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 overflow-auto flex items-center justify-center max-h-[75vh] bg-slate-50/50 rounded-2xl mt-3 border border-slate-100">
              <img 
                src={previewUrl} 
                alt={selectedFile.name} 
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FileUploader;
