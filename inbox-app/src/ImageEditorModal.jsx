import React, { useState, useRef, useEffect } from 'react';
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { 
  X, 
  RotateCw, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  UploadCloud, 
  CopyPlus 
} from 'lucide-react';

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

  // Helper to extract and save the current crop to state
  const saveCurrentCrop = () => {
    const cropOptions = { maxWidth: 1600, maxHeight: 1600, imageSmoothingEnabled: true, imageSmoothingQuality: 'high' };
    if (typeof cropperRef.current?.cropper !== "undefined") {
      const canvas = cropperRef.current.cropper.getCroppedCanvas(cropOptions);
      if (canvas) {
        const base64Image = canvas.toDataURL("image/jpeg", 0.88);
        const updatedCropped = [...croppedImages];
        updatedCropped[currentIndex] = base64Image;
        setCroppedImages(updatedCropped);
        return updatedCropped;
      }
    }
    return croppedImages;
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    saveCurrentCrop();

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
        setCurrentIndex(prev.length);
        return updated;
      });
    });

    e.target.value = '';
  };
  
  const currentUrl = localUrls[currentIndex];

  // Navigate to previous photo
  const handlePrev = () => {
    if (currentIndex > 0) {
      saveCurrentCrop();
      setCurrentIndex(currentIndex - 1);
    }
  };
  
  // Duplicate current photo to crop a second license or side from the same image
  const handleDuplicateCurrent = () => {
    if (!currentUrl) return;
    const updatedCropped = saveCurrentCrop();
    
    const newLocalUrls = [...localUrls];
    newLocalUrls.splice(currentIndex + 1, 0, currentUrl);
    
    const newCropped = [...updatedCropped];
    newCropped.splice(currentIndex + 1, 0, null);
    
    setLocalUrls(newLocalUrls);
    setCroppedImages(newCropped);
    setCurrentIndex(currentIndex + 1);
  };

  // Jump to specific index from thumbnail
  const handleSelectIndex = (idx) => {
    if (idx === currentIndex || idx < 0 || idx >= localUrls.length) return;
    saveCurrentCrop();
    setCurrentIndex(idx);
  };

  // Remove photo from list
  const handleDeletePhoto = (idx, e) => {
    e?.stopPropagation?.();
    if (localUrls.length <= 1) {
      setLocalUrls([]);
      setCroppedImages([]);
      setCurrentIndex(0);
      return;
    }
    const newLocalUrls = localUrls.filter((_, i) => i !== idx);
    const newCropped = croppedImages.filter((_, i) => i !== idx);
    setLocalUrls(newLocalUrls);
    setCroppedImages(newCropped);
    
    if (currentIndex >= newLocalUrls.length) {
      setCurrentIndex(newLocalUrls.length - 1);
    } else if (idx < currentIndex) {
      setCurrentIndex(currentIndex - 1);
    }
  };
  
  const handleNext = () => {
    const updated = saveCurrentCrop();
    
    if (currentIndex < localUrls.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Done with all images
      const cropOptions = { maxWidth: 1600, maxHeight: 1600, imageSmoothingEnabled: true, imageSmoothingQuality: 'high' };
      const finalImages = [...updated];
      if (typeof cropperRef.current?.cropper !== "undefined") {
        const canvas = cropperRef.current.cropper.getCroppedCanvas(cropOptions);
        if (canvas) {
           finalImages[currentIndex] = canvas.toDataURL("image/jpeg", 0.88);
        }
      }
      onComplete(finalImages.filter(Boolean));
    }
  };

  const handleExclude = () => {
    const updatedCropped = [...croppedImages];
    updatedCropped[currentIndex] = null;
    setCroppedImages(updatedCropped);

    if (currentIndex < localUrls.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete(updatedCropped.filter(Boolean));
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

  const isLast = currentIndex === localUrls.length - 1;

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()} 
        style={{ height: '94vh', maxWidth: '920px', width: '95%', display: 'flex', flexDirection: 'column', borderRadius: '16px', overflow: 'hidden' }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 className="modal-title" style={{ fontSize: '1.15rem', margin: 0 }}>
              Editar Fotos {localUrls.length > 0 ? `(${currentIndex + 1} de ${localUrls.length})` : ''}
            </h2>
            {folderName && (
              <span style={{ 
                backgroundColor: '#2563eb', 
                color: '#ffffff', 
                padding: '3px 10px', 
                borderRadius: '6px', 
                fontWeight: 'bold', 
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                🏷️ DL: {folderName.match(/\b([A-Za-z]?\d{3,6})\b/)?.[0]?.toUpperCase() || folderName}
              </span>
            )}
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{folderName}</span>
          </div>
          <button className="btn-icon" onClick={onClose} title="Cerrar editor">
            <X size={24} />
          </button>
        </div>
        
        {/* Cropper Container Box */}
        <div style={{ flex: 1, backgroundColor: '#111827', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative', minHeight: '320px', padding: '8px' }}>
          {currentUrl ? (
             <Cropper
                key={currentIndex + '-' + localUrls.length + '-' + (currentUrl.slice(0, 30))}
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
        
        {/* Thumbnails Navigation Strip */}
        {localUrls.length > 0 && (
          <div style={{ 
            backgroundColor: '#0f172a', 
            padding: '8px 16px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            overflowX: 'auto', 
            borderTop: '1px solid rgba(255,255,255,0.08)',
            borderBottom: '1px solid var(--border-color)',
            minHeight: '66px'
          }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap', fontWeight: '500' }}>
              Fotos ({localUrls.length}):
            </span>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {localUrls.map((url, idx) => {
                const isActive = idx === currentIndex;
                const isCropped = Boolean(croppedImages[idx]);
                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectIndex(idx)}
                    title={`Ir a foto ${idx + 1}${isCropped ? ' (Ya recortada)' : ''}`}
                    style={{
                      position: 'relative',
                      width: '48px',
                      height: '48px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isActive ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.2)',
                      boxShadow: isActive ? '0 0 8px rgba(59, 130, 246, 0.6)' : 'none',
                      backgroundColor: '#1e293b',
                      overflow: 'hidden',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <img 
                      src={url} 
                      alt={`Foto ${idx + 1}`} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                    
                    {/* Index badge */}
                    <span style={{
                      position: 'absolute',
                      bottom: 2,
                      left: 2,
                      backgroundColor: 'rgba(0,0,0,0.75)',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      padding: '1px 4px',
                      borderRadius: '4px',
                      lineHeight: '1'
                    }}>
                      {idx + 1}
                    </span>

                    {/* Cropped checkmark indicator */}
                    {isCropped && (
                      <span style={{
                        position: 'absolute',
                        top: 2,
                        left: 2,
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '9px',
                        fontWeight: 'bold'
                      }}>
                        ✓
                      </span>
                    )}

                    {/* Remove button */}
                    {localUrls.length > 1 && (
                      <button
                        onClick={(e) => handleDeletePhoto(idx, e)}
                        title="Eliminar esta foto"
                        style={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          backgroundColor: 'rgba(239, 68, 68, 0.9)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '15px',
                          height: '15px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '10px'
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick action buttons in strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
              <button 
                onClick={handleDuplicateCurrent}
                title="Duplicar foto actual para recortar la 2da licencia o reverso"
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  border: '1px dashed #3b82f6',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <CopyPlus size={14} /> + Recortar otra de esta foto
              </button>
            </div>
          </div>
        )}

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
        <div style={{ padding: '12px 18px', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface-color)', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <button className="btn-primary" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)', padding: '7px 12px', fontSize: '13px' }} onClick={rotateRight} title="Girar 90 grados" disabled={!currentUrl}>
              <RotateCw size={16} style={{ marginRight: '5px' }} /> Girar
            </button>
            <button className="btn-primary" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)', padding: '7px 10px' }} onClick={zoomIn} title="Acercar (Zoom +)" disabled={!currentUrl}>
              <ZoomIn size={16} />
            </button>
            <button className="btn-primary" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)', padding: '7px 10px' }} onClick={zoomOut} title="Alejar (Zoom -)" disabled={!currentUrl}>
              <ZoomOut size={16} />
            </button>
            <button className="btn-primary" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)', padding: '7px 11px', fontSize: '13px' }} onClick={resetFit} title="Ajustar imagen a la pantalla" disabled={!currentUrl}>
              <Maximize2 size={16} style={{ marginRight: '5px' }} /> Re-ajustar
            </button>
            <button className="btn-primary" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)', padding: '7px 10px' }} onClick={downloadCroppedImage} title="Descargar recorte actual" disabled={!currentUrl}>
              <Download size={16} />
            </button>
            <button 
              className="btn-primary" 
              style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px' }} 
              onClick={handleDuplicateCurrent} 
              title="Duplica esta foto para recortar la otra licencia o reverso"
              disabled={!currentUrl}
            >
              <CopyPlus size={16} /> Duplicar foto
            </button>
            <button 
              className="btn-primary" 
              style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-primary)', padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px' }} 
              onClick={() => fileInputRef.current?.click()} 
              title="Subir fotos adicionales desde tu equipo"
            >
              <UploadCloud size={16} /> + Subir
            </button>
          </div>
          
          {/* Navigation and Next/Submit buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginLeft: 'auto', alignItems: 'center' }}>
            <button 
              className="btn-secondary" 
              onClick={handlePrev} 
              disabled={currentIndex === 0 || isProcessing}
              title="Regresar a la foto anterior"
              style={{ padding: '7px 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px', opacity: currentIndex === 0 ? 0.45 : 1 }}
            >
              <ChevronLeft size={16} /> Anterior
            </button>

            <button 
              className="btn-secondary" 
              onClick={handleExclude} 
              disabled={isProcessing || !currentUrl} 
              style={{ color: '#ef4444', borderColor: '#ef4444', padding: '7px 12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              title="Omitir esta foto y pasar a la siguiente"
            >
              <X size={16} /> Omitir
            </button>

            <button 
              className="btn-primary" 
              onClick={handleNext} 
              disabled={isProcessing || localUrls.length === 0} 
              style={{ backgroundColor: isLast ? '#10b981' : '#3b82f6', padding: '7px 16px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
            >
              {isProcessing ? (
                <>Procesando con IA...</>
              ) : !isLast ? (
                <>Siguiente Foto <ChevronRight size={16} /></>
              ) : (
                <><CheckCircle2 size={16} /> Procesar con IA</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

