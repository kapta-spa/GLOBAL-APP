import React, { useState, useEffect } from 'react';
import { X, Send, UploadCloud, FileText, ArrowLeft, Trash2, Download, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { convertDocxToPdf } from './utils/driveConverter';
import { isValidCustomerEmail } from './utils/gmailService';

export default function EmailPreviewModal({ 
  isOpen, 
  onClose, 
  processedDocs = [], 
  folderName, 
  customerEmail, 
  token, 
  onSendEmail, 
  onBack 
}) {
  const [pdfBlobs, setPdfBlobs] = useState([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [emailTo, setEmailTo] = useState(isValidCustomerEmail(customerEmail) ? customerEmail : '');

  useEffect(() => {
    if (isOpen) {
      if (isValidCustomerEmail(customerEmail)) {
        setEmailTo(customerEmail);
      } else {
        setEmailTo('');
      }
    }
  }, [isOpen, customerEmail]);

  if (!isOpen) return null;

  const handleConvertToPdf = async () => {
    setIsConverting(true);
    setError('');
    try {
      if (!token) {
        throw new Error("No hay una sesión activa de Google. Por favor vuelve a iniciar sesión.");
      }
      if (!processedDocs || processedDocs.length === 0) {
        throw new Error("No hay documentos Word generados para convertir a PDF.");
      }
      const convertedPdfs = [];
      for (const doc of processedDocs) {
        const pdf = await convertDocxToPdf(doc.blob, `${doc.name}.docx`, token);
        convertedPdfs.push({ blob: pdf, name: doc.name });
      }
      setPdfBlobs(convertedPdfs);
    } catch (err) {
      console.error("Error convirtiendo a PDF con Google Drive:", err);
      setError(`Error Google Drive: ${err.message}`);
    } finally {
      setIsConverting(false);
    }
  };

  const handleManualPdfUpload = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newPdfs = Array.from(e.target.files).map(file => ({
        blob: file,
        name: file.name.replace(/\.pdf$/i, '')
      }));
      setPdfBlobs(prev => [...prev, ...newPdfs]);
      setError('');
    }
  };

  const handleRemovePdf = (indexToRemove) => {
    setPdfBlobs(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSend = async () => {
    if (isSending) return;
    if (pdfBlobs.length === 0) {
      alert("Necesitas tener al menos un archivo PDF adjunto antes de enviar.");
      return;
    }
    const cleanEmail = (emailTo || '').trim();
    if (!cleanEmail) {
      alert("⚠️ Por favor ingresa el correo electrónico del cliente para enviarle la traducción.");
      return;
    }
    if (!isValidCustomerEmail(cleanEmail)) {
      alert(`⚠️ ATENCIÓN: El correo ingresado (${cleanEmail}) NO es válido o es el correo de la empresa (info@globaltranslations.co.nz).\n\nPor favor ingresa el correo personal o de contacto del CLIENTE para asegurar que le llegue la traducción.`);
      return;
    }
    setIsSending(true);
    try {
      await onSendEmail(pdfBlobs, cleanEmail);
    } catch (err) {
      setIsSending(false);
    }
  };


  return (
    <div className="modal-overlay open">
      <div className="modal-content email-preview-modal" style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        {isSending && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(4px)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            color: '#ffffff',
            padding: '24px',
            textAlign: 'center'
          }}>
            <svg className="spinner" viewBox="0 0 50 50" style={{ width: 56, height: 56, marginBottom: 16 }}>
              <circle cx="25" cy="25" r="20" fill="none" />
            </svg>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.4rem', color: '#ffffff', fontWeight: 'bold' }}>
              Enviando traducción...
            </h3>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#94a3b8', maxWidth: '420px', lineHeight: '1.5' }}>
              Enviando correo al cliente con los PDFs adjuntos y actualizando Google Sheets. Por favor espera un momento...
            </p>
          </div>
        )}

        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Enviar Traducción Final</h2>
            {folderName && (
              <span style={{ 
                backgroundColor: '#10b981', 
                color: '#ffffff', 
                padding: '4px 12px', 
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
            <span style={{ fontSize: '13px', color: '#6b7280' }}>({folderName})</span>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={isSending}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="pdf-section" style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: '#1e293b' }}>1. Preparar PDF</h3>
            
            {pdfBlobs.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem' }}>
                  Elige cómo deseas generar o adjuntar el PDF para el cliente:
                </p>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                  <button 
                    className="btn-primary" 
                    onClick={handleConvertToPdf} 
                    disabled={isConverting || processedDocs.length === 0}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '6px' }}
                  >
                    {isConverting ? (
                      <><RefreshCw size={18} className="spinning" /> Convirtiendo con Google Drive ({processedDocs.length})...</>
                    ) : (
                      <><FileText size={18} /> Convertir con Google Drive ({processedDocs.length})</>
                    )}
                  </button>

                  <label className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 18px', borderRadius: '6px' }}>
                    <UploadCloud size={18} /> Subir PDF Manual
                    <input type="file" accept=".pdf,application/pdf" multiple style={{ display: 'none' }} onChange={handleManualPdfUpload} />
                  </label>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                {pdfBlobs.map((pdfItem, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#16a34a', background: '#f0fdf4', padding: '10px 14px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileText size={20} />
                      <span><strong>¡PDF Listo!</strong> {pdfItem.name}.pdf ({Math.round(pdfItem.blob.size / 1024)} KB)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        onClick={() => {
                          const url = URL.createObjectURL(pdfItem.blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${pdfItem.name}.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        style={{ padding: '4px 8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                        title="Descargar PDF"
                      >
                        <Download size={14} /> Ver
                      </button>
                      <button 
                        onClick={() => handleRemovePdf(index)}
                        style={{ padding: '4px 8px', background: '#ffffff', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                        title="Eliminar este PDF"
                      >
                        <Trash2 size={14} /> Eliminar
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: '6px' }}>
                  <button 
                    className="btn-secondary" 
                    onClick={handleConvertToPdf} 
                    disabled={isConverting || processedDocs.length === 0}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '6px 12px', borderRadius: '6px' }}
                  >
                    {isConverting ? (
                      <><RefreshCw size={14} className="spinning" /> Reconvirtiendo...</>
                    ) : (
                      <><RefreshCw size={14} /> Reconvertir con Drive</>
                    )}
                  </button>
                  <label className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', padding: '6px 12px', borderRadius: '6px' }}>
                    <UploadCloud size={14} /> Agregar otro PDF
                    <input type="file" accept=".pdf,application/pdf" multiple style={{ display: 'none' }} onChange={handleManualPdfUpload} />
                  </label>
                  <button className="btn-text" onClick={() => setPdfBlobs([])} style={{ color: '#ef4444', fontSize: '0.85rem' }}>
                    Eliminar todos
                  </button>
                </div>
              </div>
            )}
            
            {error && <div style={{ color: '#ef4444', marginTop: '10px', fontSize: '0.9rem' }}>{error}</div>}
          </div>

          <div className="email-preview-section" style={{ padding: '16px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: '#1e293b' }}>2. Previsualización del Correo</h3>
            
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <strong style={{ minWidth: '120px', color: '#1e293b' }}>Correo Cliente:</strong> 
                  <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input 
                      type="email" 
                      value={emailTo} 
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="ejemplo: cliente@gmail.com (escribe el correo del cliente)"
                      style={{ 
                        width: '100%', 
                        padding: '10px 36px 10px 12px', 
                        border: `2px solid ${!emailTo ? '#f59e0b' : isValidCustomerEmail(emailTo) ? '#10b981' : '#ef4444'}`, 
                        borderRadius: '6px', 
                        fontSize: '14px',
                        outline: 'none',
                        backgroundColor: !emailTo ? '#fffbeb' : isValidCustomerEmail(emailTo) ? '#f0fdf4' : '#fef2f2'
                      }}
                    />
                    <div style={{ position: 'absolute', right: '10px', display: 'flex', alignItems: 'center' }}>
                      {isValidCustomerEmail(emailTo) ? (
                        <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                      ) : (
                        <AlertTriangle size={18} style={{ color: !emailTo ? '#f59e0b' : '#ef4444' }} />
                      )}
                    </div>
                  </div>
                </div>

                {!emailTo && (
                  <div style={{ marginLeft: '130px', fontSize: '12px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ⚠️ No se detectó correo automático. Por favor escribe aquí el correo electrónico del cliente.
                  </div>
                )}

                {emailTo && !isValidCustomerEmail(emailTo) && (
                  <div style={{ marginLeft: '130px', fontSize: '12px', color: '#dc2626', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ⛔ Error: Has ingresado "{emailTo}". Este correo pertenece a la empresa o al sistema y NO al cliente. Escribe el correo del cliente.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <strong style={{ minWidth: '120px', color: '#1e293b' }}>Asunto:</strong> <span style={{ color: '#475569' }}>Your Translation is ready!</span>
              </div>
              <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#ffffff', fontSize: '14px', fontFamily: 'Arial, sans-serif', color: '#000000' }}>
                
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  Hello, your translation is ready 💫
                  <br /><br />
                  <strong style={{ color: '#ef4444' }}>⚠️ IMPORTANT ⚠️</strong>
                  <br /><br />
                  <strong style={{ color: '#ef4444' }}>As part of our quality management process, please check all names, dates, and numbers, and let us know if any corrections are required.</strong>
                </div>

                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                  If everything is correct, the translation is ready to use.
                  <br /><br />
                  We provide fast and reliable certified translation and interpreting services in all major world languages. We wish you all the best and would be happy to assist you with any future projects.
                </div>

                <div style={{ textAlign: 'center', fontSize: '13px', lineHeight: '1.6' }}>
                  Kind Regards,<br />
                  Juan Carlos Flores<br />
                  W: <a href="http://www.globaltranslations.co.nz">www.globaltranslations.co.nz</a><br />
                  E: <a href="mailto:info@globaltranslations.co.nz">info@globaltranslations.co.nz</a><br />
                  P: +64 6 560 2232 M: +64 22 096 2125<br />
                  <a href="https://wa.me/64220962125">WhatsApp Chat</a>
                </div>

                <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                  Ngā Mihi. शुक्रिया. Thank you. 谢谢. Gracias. ありがとう. Danke. شكرا. Obrigado.<br />
                  “The World is but one country, and mankind its citizens.” Bahá’u’lláh
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: '#64748b' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UploadCloud size={16} /> <strong>Adjuntos ({pdfBlobs.length}):</strong> 
                  {pdfBlobs.length === 0 && 'Ninguno (requiere generar PDF primero)'}
                </div>
                {pdfBlobs.map((pdfItem, index) => (
                  <div key={index} style={{ marginLeft: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span>- {pdfItem.name}.pdf</span>
                    <button 
                      onClick={() => {
                        const url = URL.createObjectURL(pdfItem.blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${pdfItem.name}.pdf`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      style={{ padding: '2px 6px', background: 'transparent', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#2563eb', fontSize: '0.75rem' }}
                    >
                      Descargar
                    </button>
                    <button 
                      onClick={() => handleRemovePdf(index)}
                      style={{ padding: '2px 6px', background: 'transparent', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', color: '#ef4444', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                      title="Eliminar adjunto"
                    >
                      <Trash2 size={12} /> Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn-secondary" onClick={onBack} disabled={isSending} style={{ marginRight: 'auto', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={18} style={{ marginRight: '8px' }} /> Volver
          </button>
          <button className="btn-secondary" onClick={onClose} disabled={isSending}>Cancelar</button>
          <button 
            className="btn-primary" 
            onClick={handleSend} 
            disabled={pdfBlobs.length === 0 || isSending}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '175px', gap: '8px' }}
          >
            {isSending ? (
              <>
                <svg className="spinner" viewBox="0 0 50 50" style={{ width: 18, height: 18, margin: 0 }}>
                  <circle cx="25" cy="25" r="20" fill="none" />
                </svg>
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <Send size={18} style={{ flexShrink: 0 }} /> Enviar Correo Final
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
