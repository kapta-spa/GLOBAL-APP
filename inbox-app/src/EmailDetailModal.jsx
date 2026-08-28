import React, { useState, useEffect } from 'react';
import { X, Check, Mail, Calendar, User, CheckCircle2, Paperclip, Eye, Crop, Download, Image as ImageIcon, FileText, Loader2 } from 'lucide-react';

export default function EmailDetailModal({ 
  email, 
  isOpen, 
  onClose, 
  isSelected, 
  onToggleSelect, 
  token,
  onProcessAttachments 
}) {
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  useEffect(() => {
    if (isOpen && email && token) {
      fetchMessageAttachments();
    } else {
      setAttachments([]);
      setPreviewImageUrl(null);
      setDownloadingId(null);
    }
  }, [isOpen, email, token]);

  if (!isOpen || !email) return null;

  const fetchMessageAttachments = async () => {
    setLoadingAttachments(true);
    try {
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      
      const foundAttachments = [];
      const searchParts = (parts) => {
        if (!parts) return;
        for (const part of parts) {
          if (part.parts) searchParts(part.parts);
          if (part.filename && part.body && part.body.attachmentId) {
            foundAttachments.push({
              id: part.body.attachmentId,
              filename: part.filename,
              mimeType: part.mimeType || 'application/octet-stream',
              size: part.body.size || 0
            });
          }
        }
      };

      if (data.payload) {
        if (data.payload.parts) searchParts(data.payload.parts);
        else if (data.payload.filename && data.payload.body?.attachmentId) {
          foundAttachments.push({
            id: data.payload.body.attachmentId,
            filename: data.payload.filename,
            mimeType: data.payload.mimeType,
            size: data.payload.body.size
          });
        }
      }

      setAttachments(foundAttachments);
    } catch (err) {
      console.error("Error al buscar adjuntos del correo:", err);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const getAttachmentDataUrl = async (attachmentId, mimeType) => {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error("No se pudo descargar el adjunto.");
    const data = await res.json();
    const base64Data = data.data.replace(/-/g, '+').replace(/_/g, '/');
    return `data:${mimeType || 'image/jpeg'};base64,${base64Data}`;
  };

  const handleSendToEditor = async (att) => {
    setDownloadingId(att.id);
    try {
      const dataUrl = await getAttachmentDataUrl(att.id, att.mimeType);
      onClose();
      if (onProcessAttachments) {
        onProcessAttachments([dataUrl], email.subject || 'Correo');
      }
    } catch (err) {
      alert("Error al cargar la imagen en el editor: " + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSendAllToEditor = async () => {
    const imageAtts = attachments.filter(a => a.mimeType.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(a.filename));
    if (imageAtts.length === 0) return;

    setDownloadingId('ALL');
    try {
      const urls = await Promise.all(
        imageAtts.map(att => getAttachmentDataUrl(att.id, att.mimeType))
      );
      onClose();
      if (onProcessAttachments) {
        onProcessAttachments(urls, email.subject || 'Correo');
      }
    } catch (err) {
      alert("Error al cargar las imágenes: " + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (att) => {
    setDownloadingId(att.id);
    try {
      const dataUrl = await getAttachmentDataUrl(att.id, att.mimeType);
      setPreviewImageUrl(dataUrl);
    } catch (err) {
      alert("Error al previsualizar la imagen.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownload = async (att) => {
    setDownloadingId(att.id);
    try {
      const dataUrl = await getAttachmentDataUrl(att.id, att.mimeType);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = att.filename;
      a.click();
    } catch (err) {
      alert("Error al descargar el archivo.");
    } finally {
      setDownloadingId(null);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = (att) => att.mimeType.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(att.filename);

  const imageAttachments = attachments.filter(isImage);

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          maxWidth: '800px', 
          width: '92%', 
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)'
        }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Mail size={22} style={{ color: 'var(--accent-color)' }} />
            <h2 className="modal-title" style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)' }}>
              Detalle del Correo
            </h2>
          </div>
          <button className="btn-icon" onClick={onClose} title="Cerrar">
            <X size={24} />
          </button>
        </div>

        {/* Email Metadata Header Box */}
        <div style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.03)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '10px', 
          padding: '16px', 
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px', wordBreak: 'break-word' }}>
            {email.subject || 'Sin Asunto'}
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={15} style={{ color: 'var(--accent-color)' }} />
              <span><strong>De:</strong> {email.fromRaw || email.sender}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={15} style={{ color: 'var(--accent-color)' }} />
              <span><strong>Fecha:</strong> {email.rawDate || email.date}</span>
            </div>
          </div>
        </div>

        {/* Scrollable Container for Email Body & Attachments */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
          
          {/* Email Body Text Box */}
          <div style={{ 
            backgroundColor: 'var(--bg-color)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '10px', 
            padding: '20px 24px', 
            color: 'var(--text-primary)', 
            fontSize: '15px', 
            lineHeight: '1.75', 
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'var(--font-family)'
          }}>
            {email.fullBody || email.snippet || '(Sin contenido de texto)'}
          </div>

          {/* Image Preview Window (If User Clicked Preview) */}
          {previewImageUrl && (
            <div style={{ border: '1px solid var(--accent-color)', borderRadius: '10px', padding: '12px', backgroundColor: 'rgba(59, 130, 246, 0.05)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--accent-color)' }}>Previsualización de Imagen:</strong>
                <button className="btn-icon" onClick={() => setPreviewImageUrl(null)} title="Cerrar Previsualización">
                  <X size={18} />
                </button>
              </div>
              <img src={previewImageUrl} alt="preview" style={{ maxWidth: '100%', maxHeight: '350px', objectFit: 'contain', borderRadius: '6px', margin: '0 auto', display: 'block' }} />
            </div>
          )}

          {/* Attachments Section */}
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                <Paperclip size={18} style={{ color: 'var(--accent-color)' }} />
                <span>Archivos Adjuntos {loadingAttachments ? '(Cargando...)' : `(${attachments.length})`}</span>
              </div>

              {imageAttachments.length > 1 && (
                <button 
                  className="btn-primary" 
                  style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'var(--accent-color)' }}
                  onClick={handleSendAllToEditor}
                  disabled={downloadingId === 'ALL'}
                >
                  {downloadingId === 'ALL' ? 'Cargando todas...' : `✂️ Enviar ${imageAttachments.length} fotos al Editor`}
                </button>
              )}
            </div>

            {loadingAttachments ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '12px', textAlign: 'center' }}>
                Buscando archivos adjuntos...
              </div>
            ) : attachments.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '8px 0' }}>
                Este correo no contiene archivos adjuntos.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {attachments.map((att) => {
                  const isImg = isImage(att);
                  const isDownloading = downloadingId === att.id;

                  return (
                    <div 
                      key={att.id}
                      style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        gap: '10px', 
                        padding: '10px 14px', 
                        backgroundColor: 'var(--surface-color)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '8px' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '200px' }}>
                        {isImg ? (
                          <ImageIcon size={20} style={{ color: '#3b82f6', flexShrink: 0 }} />
                        ) : (
                          <FileText size={20} style={{ color: '#94a3b8', flexShrink: 0 }} />
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {att.filename}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {formatSize(att.size)}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons for Attachment */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isImg && (
                          <>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => handlePreview(att)}
                              disabled={isDownloading}
                              title="Previsualizar imagen"
                            >
                              <Eye size={14} /> Ver
                            </button>

                            <button 
                              className="btn-primary" 
                              style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#10b981' }}
                              onClick={() => handleSendToEditor(att)}
                              disabled={isDownloading}
                              title="Enviar directo al editor de fotos e IA sin descargar"
                            >
                              {isDownloading ? 'Cargando...' : <><Crop size={14} /> Pasar al Editor</>}
                            </button>
                          </>
                        )}

                        <button 
                          className="btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => handleDownload(att)}
                          disabled={isDownloading}
                          title="Descargar archivo a tu PC"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
          <button 
            type="button"
            className={isSelected ? "btn-secondary" : "btn-primary"} 
            onClick={() => onToggleSelect(email.id)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              backgroundColor: isSelected ? '#10b981' : 'var(--accent-color)', 
              color: 'white',
              borderRadius: '8px',
              padding: '10px 18px' 
            }}
          >
            {isSelected ? (
              <><CheckCircle2 size={18} /> Seleccionado</>
            ) : (
              <><Check size={18} /> Seleccionar Correo</>
            )}
          </button>

          <button className="btn-secondary" onClick={onClose} style={{ borderRadius: '8px', padding: '10px 20px' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
