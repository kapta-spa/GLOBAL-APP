import React, { useState, useEffect } from 'react';
import { X, UploadCloud, Image as ImageIcon, Trash2, ArrowRight, Download, Mail, RefreshCw } from 'lucide-react';

export default function ManualUploadModal({ isOpen, onClose, folderName, label, token, onImagesLoaded }) {
  const [imageItems, setImageItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingGmail, setIsFetchingGmail] = useState(false);
  const [gmailStatus, setGmailStatus] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setImageItems([]);
      setIsLoading(false);
      setIsFetchingGmail(false);
      setGmailStatus('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      
      Promise.all(
        newFiles.map(file => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ id: Math.random().toString(), dataUrl: reader.result, name: file.name });
            reader.readAsDataURL(file);
          });
        })
      ).then(newLoadedItems => {
        setImageItems(prev => [...prev, ...newLoadedItems]);
      });
    }
  };

  const handleFetchGmailAttachments = async () => {
    if (!label || !token) {
      alert("No se pudo identificar la carpeta o la sesión de Google.");
      return;
    }

    setIsFetchingGmail(true);
    setGmailStatus('Buscando correos de la orden...');

    try {
      // 1. Fetch messages for label
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${label.id}&maxResults=5`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Error al obtener correos de la carpeta.");
      const data = await res.json();

      if (!data.messages || data.messages.length === 0) {
        setGmailStatus('No se encontraron correos en esta carpeta.');
        return;
      }

      setGmailStatus(`Revisando ${data.messages.length} correo(s) por imágenes adjuntas...`);
      const downloadedImages = [];

      for (const msg of data.messages) {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!msgRes.ok) continue;
        const msgData = await msgRes.json();

        const searchParts = async (parts) => {
          if (!parts) return;
          for (const part of parts) {
            if (part.parts) await searchParts(part.parts);
            const mimeType = part.mimeType || '';
            const filename = part.filename || 'adjunto.jpg';
            const body = part.body || {};

            const isImageMime = mimeType.toLowerCase().startsWith('image/');
            const isImageExt = /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(filename);

            if ((isImageMime || isImageExt) && body.attachmentId) {
              try {
                const attachRes = await fetch(
                  `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${body.attachmentId}`,
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                if (attachRes.ok) {
                  const attachData = await attachRes.json();
                  if (attachData.data) {
                    const base64Data = attachData.data.replace(/-/g, '+').replace(/_/g, '/');
                    const finalMime = mimeType || 'image/jpeg';
                    const dataUrl = `data:${finalMime};base64,${base64Data}`;
                    downloadedImages.push({
                      id: body.attachmentId,
                      dataUrl,
                      name: filename
                    });
                  }
                }
              } catch (err) {
                console.error("Error al descargar adjunto:", err);
              }
            }
          }
        };

        if (msgData.payload) {
          if (msgData.payload.parts) await searchParts(msgData.payload.parts);
          else if (msgData.payload.body && msgData.payload.body.attachmentId) {
            await searchParts([msgData.payload]);
          }
        }
      }

      if (downloadedImages.length === 0) {
        setGmailStatus('No se encontraron archivos de imagen adjuntos en los correos.');
      } else {
        setGmailStatus(`¡Se descargaron ${downloadedImages.length} foto(s) del correo!`);
        setImageItems(prev => [...prev, ...downloadedImages]);
      }
    } catch (err) {
      console.error("Error al buscar adjuntos:", err);
      setGmailStatus(`Error: ${err.message}`);
    } finally {
      setIsFetchingGmail(false);
    }
  };

  const handleRemoveItem = (index) => {
    setImageItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (imageItems.length === 0) {
      alert("Por favor selecciona o descarga al menos una imagen.");
      return;
    }

    onImagesLoaded(imageItems.map(item => item.dataUrl));
    setImageItems([]);
  };

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '700px', width: '92%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', borderRadius: '16px', padding: '24px' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UploadCloud size={24} style={{ color: 'var(--accent-color)' }} />
            <h2 className="modal-title" style={{ fontSize: '1.2rem', margin: 0 }}>
              Fotos de la Orden: {folderName || 'Orden'}
            </h2>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Option 1: Automatic Download from Email Attachments */}
          {label && (
            <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid var(--accent-color)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  <Mail size={18} style={{ color: 'var(--accent-color)' }} />
                  <span>Obtener Fotos Adjuntas del Correo</span>
                </div>

                <button 
                  className="btn-primary" 
                  style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={handleFetchGmailAttachments}
                  disabled={isFetchingGmail}
                >
                  {isFetchingGmail ? (
                    <><RefreshCw size={16} className="spin" /> Buscando fotos en Gmail...</>
                  ) : (
                    <><Download size={16} /> Descargar Fotos del Correo</>
                  )}
                </button>
              </div>

              {gmailStatus && (
                <div style={{ fontSize: '0.82rem', color: isFetchingGmail ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
                  {gmailStatus}
                </div>
              )}
            </div>
          )}

          {/* Option 2: Upload Local Files from PC */}
          <div 
            style={{ 
              border: '2px dashed var(--border-color)', 
              borderRadius: '12px', 
              padding: '20px', 
              textAlign: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              cursor: 'pointer',
              transition: 'border-color 0.2s'
            }}
            onClick={() => document.getElementById('manual-file-input').click()}
          >
            <UploadCloud size={32} style={{ margin: '0 auto 8px', color: 'var(--accent-color)', opacity: 0.8 }} />
            <div style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '2px' }}>
              O subir fotos manualmente desde tu computadora
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Soporta PNG, JPG, JPEG, WEBP
            </div>
            <input 
              id="manual-file-input"
              type="file" 
              accept="image/*" 
              multiple 
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {/* Selected / Loaded Images Grid */}
          {imageItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                Fotos listas para procesar ({imageItems.length}):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px' }}>
                {imageItems.map((item, index) => (
                  <div key={index} style={{ position: 'relative', width: '100%', height: '110px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', backgroundColor: '#000' }}>
                    <img src={item.dataUrl} alt={item.name || `photo-${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '0.7rem', padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name || `Foto ${index + 1}`}
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRemoveItem(index); }}
                      style={{ 
                        position: 'absolute', 
                        top: '4px', 
                        right: '4px', 
                        background: 'rgba(239, 68, 68, 0.9)', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '50%', 
                        width: '24px', 
                        height: '24px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        cursor: 'pointer' 
                      }}
                      title="Eliminar"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {imageItems.length > 0 ? `${imageItems.length} foto(s) lista(s)` : 'Selecciona o descarga fotos'}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button 
              className="btn-primary" 
              onClick={handleConfirm} 
              disabled={imageItems.length === 0 || isLoading || isFetchingGmail}
            >
              Continuar al Editor <ArrowRight size={18} style={{ marginLeft: '6px' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
