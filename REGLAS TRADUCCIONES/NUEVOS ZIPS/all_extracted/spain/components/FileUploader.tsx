
import React from 'react';
import { FileUp, Image as ImageIcon, CheckCircle, X, ClipboardPaste, RefreshCw, Eye } from 'lucide-react';
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
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [showModal, setShowModal] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  const isImage = accept.includes('image');
  const inputId = `input-${label.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;

  React.useEffect(() => {
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

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
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
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        {selectedFile && isImage && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
            {formatFileSize(selectedFile.size)}
          </span>
        )}
      </div>

      <motion.div 
        whileHover={{ scale: 1.01, y: -2 }}
        whileTap={{ scale: 0.99 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-[2rem] p-6 transition-all cursor-pointer group h-full flex flex-col justify-center
          ${isDragging 
            ? 'border-indigo-500 bg-indigo-50/50 shadow-lg' 
            : selectedFile 
              ? 'border-emerald-200 bg-emerald-50/20' 
              : 'border-slate-200 bg-white hover:border-indigo-400 hover:shadow-xl shadow-indigo-100/20'}`}
        onClick={() => document.getElementById(inputId)?.click()}
      >
        <input 
          id={inputId}
          type="file" 
          accept={accept} 
          className="hidden" 
          onChange={handleChange}
        />
        
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <AnimatePresence mode="wait">
            {selectedFile ? (
              <motion.div 
                key="selected"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="flex flex-col items-center w-full"
              >
                {isImage && previewUrl ? (
                  <div className="w-full flex flex-col items-center gap-3">
                    <div className="relative w-full aspect-[16/10] max-h-52 rounded-2xl overflow-hidden bg-slate-900/5 border border-slate-200/90 shadow-sm group/preview">
                      <img 
                        src={previewUrl} 
                        alt={selectedFile.name} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain p-1.5 transition-transform duration-300 group-hover/preview:scale-[1.02]"
                      />
                      
                      {/* Floating status badge */}
                      <div className="absolute top-2.5 left-2.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600/90 text-white text-[10px] font-black uppercase tracking-wider shadow-sm backdrop-blur-xs">
                          <CheckCircle size={12} /> Lista
                        </span>
                      </div>

                      {/* Zoom button overlay */}
                      <div className="absolute top-2.5 right-2.5">
                        <button 
                          id={`btn-view-${inputId}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowModal(true);
                          }}
                          className="w-8 h-8 rounded-xl bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center transition-all shadow-md backdrop-blur-xs"
                          title="Ampliar imagen"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-black text-slate-800 truncate max-w-[240px]" title={selectedFile.name}>
                      {selectedFile.name}
                    </p>

                    <div className="flex items-center gap-2 mt-1">
                      <button 
                        id={`btn-change-${inputId}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          document.getElementById(inputId)?.click();
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-[10px] font-black rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                      >
                        <RefreshCw size={12} /> CAMBIAR
                      </button>
                      <button 
                        id={`btn-remove-${inputId}`}
                        type="button"
                        onClick={clearFile}
                        className="px-3 py-1.5 bg-white border border-red-200 text-red-500 hover:bg-red-50 text-[10px] font-black rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                      >
                        <X size={12} /> ELIMINAR
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-4">
                      <CheckCircle size={32} />
                    </div>
                    <p className="text-sm font-black text-emerald-900 truncate max-w-[220px]">
                      {selectedFile.name}
                    </p>
                    <button 
                      id={`btn-remove-doc-${inputId}`}
                      type="button"
                      onClick={clearFile}
                      className="mt-4 px-4 py-1.5 bg-white border border-red-100 text-[10px] font-black text-red-500 hover:bg-red-50 rounded-xl flex items-center gap-2 transition-all"
                    >
                      <X size={12} /> ELIMINAR
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4 py-2"
              >
                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-300 ${
                  isDragging 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110' 
                    : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-lg shadow-indigo-200'
                }`}>
                  {icon === 'file' ? <FileUp size={32} /> : <ImageIcon size={32} />}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800">
                    {isDragging ? '¡Suelta el archivo aquí!' : isImage ? 'Subir, arrastrar o PEGAR' : 'Click para subir o arrastra'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">
                    {isImage ? 'JPG, PNG hasta 10MB' : 'Documento Word (.docx)'}
                  </p>
                </div>
                {isImage && (
                  <div className="flex items-center gap-2 text-[10px] text-indigo-500 font-black uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                    <ClipboardPaste size={12} /> PEGAR DESDE CLIPBOARD (CTRL+V)
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Lightbox Modal to enlarge photo */}
      <AnimatePresence>
        {showModal && previewUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
            onClick={() => setShowModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[2.5rem] overflow-hidden max-w-3xl w-full shadow-2xl border border-white/20 flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-sm">{label}</h4>
                    <p className="text-xs text-slate-400 font-medium truncate max-w-sm">{selectedFile?.name}</p>
                  </div>
                </div>
                <button 
                  id={`btn-close-modal-${inputId}`}
                  onClick={() => setShowModal(false)}
                  className="w-10 h-10 rounded-full hover:bg-slate-200/60 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-auto flex items-center justify-center bg-slate-100/50 min-h-[300px]">
                <img 
                  src={previewUrl} 
                  alt={selectedFile?.name || "Preview"} 
                  referrerPolicy="no-referrer"
                  className="max-h-[65vh] w-auto object-contain rounded-2xl shadow-lg border border-slate-200"
                />
              </div>

              <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>{selectedFile ? formatFileSize(selectedFile.size) : ''}</span>
                <button 
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUploader;
