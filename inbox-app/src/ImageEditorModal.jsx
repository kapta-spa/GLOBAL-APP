import React, { useState, useRef, useEffect } from 'react';
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { X, RotateCw, CheckCircle2, ChevronRight, Download, ZoomIn, ZoomOut, Maximize2, UploadCloud } from 'lucide-react';

export default function ImageEditorModal({ 
  isOpen, 
  onClose, 
  imageUrls: initialUrls, 
  onComplete,
  folderName,
  isProcessing
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localUrls, setLocalUrls] = useState([]);
  const [croppedImages, setCroppedImages] = useState([]);
  const cropperRef = useRef(null);
  const fileInputRef = useRef(null);
  
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setCroppedImages([]);
      setLocalUrls(initialUrls || []);
    }
  }, [isOpen, initialUrls]);
  
  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const readers = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then(dataUrls => {
      setLocalUrls(prev => {
        const updated = [...prev, ...dataUrls];
        // Focus view on the first newly added image
        setCurrentIndex(prev.length);
        return updated;
      });
    });

    e.target.value = '';
  };
  
  const currentUrl = localUrls[currentIndex];
  
  const handleNext = () => {
    const cropOptions = { maxWidth: 1200, maxHeight: 1200, imageSmoothingEnabled: true, imageSmoothingQuality: 'high' };
    if (typeof cropperRef.current?.cropper !== "undefined") {
      const canvas = cropperRef.current.cropper.getCroppedCanvas(cropOptions);
      if (canvas) {
        const base64Image = canvas.toDataURL("image/jpeg", 0.82);
        const updatedCropped = [...croppedImages];
        updatedCropped[currentIndex] = base64Image;
        setCroppedImages(updatedCropped);
      }
    }
    
    if (currentIndex < localUrls.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Done with all images
      const finalImages = [...croppedImages];
      if (typeof cropperRef.current?.cropper !== "undefined") {
        const canvas = cropperRef.current.cropper.getCroppedCanvas(cropOptions);
        if (canvas) {
           finalImages[currentIndex] = canvas.toDataURL("image/jpeg", 0.82);
        }
      }
      onComplete(finalImages.filter(Boolean));
    }
  };

  const handleExclude = () => {
    if (currentIndex < localUrls.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete(croppedImages.filter(Boolean));
    }
  };
  
  const rotateRight = () => {
    if (typeof cropperRef.current?.cropper !== "undefined") {
      const cropper = cropperRef.current.cropper;
      cropper.rotate(90);
    }
  };

  const zoomIn = () => {
    if (typeof cropperRef.current?.cropper !== "undefined") {
      cropperRef.current.cropper.zoom(0.1);
    }
  };

  const zoomOut = () => {
    if (typeof cropperRef.current?.cropper !== "undefined") {
      cropperRef.current.cropper.zoom(-0.1);
    }
  };

  const resetFit = () => {
    if (typeof cropperRef.current?.cropper !== "undefined") {
      cropperRef.current.cropper.reset();
    }
  };

  const downloadCroppedImage = () => {
    if (typeof cropperRef.current?.cropper !== "undefined") {
      const canvas = cropperRef.current.cropper.getCroppedCanvas();
      if (canvas) {
        const url = canvas.toDataURL("image/jpeg", 0.9);
        const a = document.createElement('a');
        a.href = url;
        a.download = `editada_${currentIndex + 1}.jpg`;
        a.click();
      }
    }
  };

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()} 
        style={{ height: '92vh', maxWidth: '850px', width: '94%', display: 'flex', flexDirection: 'column', borderRadius: '16px', overflow: 'hidden' }}
      >
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', margin: 0 }}>
          <h2 className="modal-title" style={{ fontSize: '1.15rem' }}>
            Editar Foto: {folderName} {localUrls.length > 0 ? `(${currentIndex + 1} de ${localUrls.length})` : '(Sin fotos)'}
          </h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        {/* Cropper Container Box */}
        <div style={{ flex: 1, backgroundColor: '#111827', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative', minHeight: '350px', padding: '10px' }}>
          {currentUrl ? (
             <Cropper
                key={currentIndex + '-' + localUrls.length}
                ref={cropperRef}
                src={currentUrl}
                style={{ height: "100%", width: "100%" }}
                viewMode={2}
                guides={true}
                background={false}
                responsive={true}
                autoCropArea={0.88}
                checkOrientation={false}
                center={true}
                restore={true}
              />
          ) : (
            <div style={{ color: 'white', textAlign: 'center', padding: '20px' }}>
              <p style={{ marginBottom: '16px', fontSize: '1rem', color: '#9ca3af' }}>No hay imágenes cargadas para este pedido.</p>
              <button 
                className="btn-primary" 
                onClick={() => fileInputRef.current?.click()}
                style={{ backgroundColor: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.95rem' }}
              >
                <UploadCloud size={20} /> Cargar fotos desde mi equipo
              </button>
            </div>
          )}
        </div>
        
        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          multiple 
          onChange={handleFileUpload} 
          style={{ display: 'none' }} 
        />

        {/* Controls Toolbar */}
        <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface-color)', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <button className="btn-primary" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)', padding: '8px 14px' }} onClick={rotateRight} title="Girar 90 grados" disabled={!currentUrl}>
              <RotateCw size={18} style={{ marginRight: '6px' }} /> Girar
            </button>
            <button className="btn-primary" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)', padding: '8px 12px' }} onClick={zoomIn} title="Acercar (Zoom +)" disabled={!currentUrl}>
              <ZoomIn size={18} />
            </button>
            <button className="btn-primary" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)', padding: '8px 12px' }} onClick={zoomOut} title="Alejar (Zoom -)" disabled={!currentUrl}>
              <ZoomOut size={18} />
            </button>
            <button className="btn-primary" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)', padding: '8px 12px' }} onClick={resetFit} title="Ajustar imagen a la pantalla" disabled={!currentUrl}>
              <Maximize2 size={18} style={{ marginRight: '6px' }} /> Re-ajustar
            </button>
            <button className="btn-primary" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)', padding: '8px 12px' }} onClick={downloadCroppedImage} title="Descargar imagen editada" disabled={!currentUrl}>
              <Download size={18} />
            </button>
            <button className="btn-primary" style={{ backgroundColor: '#3b82f6', color: '#ffffff', padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => fileInputRef.current?.click()} title="Subir fotos adicionales desde tu equipo">
              <UploadCloud size={18} /> + Subir Foto
            </button>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginLeft: 'auto', alignItems: 'center' }}>
            <button className="btn-secondary" onClick={handleExclude} disabled={isProcessing || !currentUrl} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
              <X size={18} style={{ marginRight: '6px' }} /> Omitir
            </button>
            <button className="btn-primary" onClick={handleNext} disabled={isProcessing || localUrls.length === 0} style={{ backgroundColor: '#10b981' }}>
              {isProcessing ? (
                <>Procesando con IA...</>
              ) : currentIndex < localUrls.length - 1 ? (
                <>Siguiente Foto <ChevronRight size={18} style={{ marginLeft: '6px' }} /></>
              ) : (
                <><CheckCircle2 size={18} style={{ marginRight: '6px' }} /> Procesar con IA</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
