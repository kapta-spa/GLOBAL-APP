import React, { useState, useEffect } from 'react';
import { X, Send, UploadCloud, RefreshCw, FileText, ArrowLeft, Trash2 } from 'lucide-react';
import { convertDocxToPdf } from './utils/convertApi';

export default function EmailPreviewModal({ 
  isOpen, 
  onClose, 
  processedDocs = [], 
  folderName, 
  customerEmail,
  onSendEmail,
  onBack
}) {
  const [pdfBlobs, setPdfBlobs] = useState([]);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState('');
  const [emailTo, setEmailTo] = useState(customerEmail || '');

  useEffect(() => {
    if (isOpen && customerEmail) {
      setEmailTo(customerEmail);
    }
  }, [isOpen, customerEmail]);

  if (!isOpen) return null;

  const handleConvertToPdf = async () => {
    setIsConverting(true);
    setError('');
    try {
      const convertedPdfs = [];
      for (const doc of processedDocs) {
        const pdf = await convertDocxToPdf(doc.blob, `${doc.name}.docx`);
        convertedPdfs.push({ blob: pdf, name: doc.name });
      }
      setPdfBlobs(convertedPdfs);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsConverting(false);
    }
  };

  const handleManualPdfUpload = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newPdfs = Array.from(e.target.files).map(file => ({
        blob: file,
        name: file.name.replace('.pdf', '')
      }));
      setPdfBlobs([...pdfBlobs, ...newPdfs]);
    }
  };

  const handleRemovePdf = (indexToRemove) => {
    setPdfBlobs(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSend = () => {
    if (pdfBlobs.length === 0) {
      alert("Necesitas tener al menos un PDF listo antes de enviar.");
      return;
    }
    if (!emailTo) {
      alert("Por favor ingresa un correo electrónico de destino.");
      return;
    }
    onSendEmail(pdfBlobs, emailTo);
  };

  return (
    <div className="modal-overlay open">
      <div className="modal-content email-preview-modal" style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>Enviar Traducción Final</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="pdf-section" style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: '#1e293b' }}>1. Preparar PDF</h3>
            
            {pdfBlobs.length === 0 ? (
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button 
                  className="btn-primary" 
                  onClick={handleConvertToPdf} 
                  disabled={isConverting || processedDocs.length === 0}
                >
                  {isConverting ? (
                    <><RefreshCw size={18} className="spin" /> Convirtiendo {processedDocs.length} arch...</>
                  ) : (
                    <><FileText size={18} /> Convertir Word a PDF Automático ({processedDocs.length})</>
                  )}
                </button>

                <div className="file-input-wrapper">
                  <label className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <UploadCloud size={18} /> Subir PDF Manual
                    <input type="file" accept=".pdf" multiple style={{ display: 'none' }} onChange={handleManualPdfUpload} />
                  </label>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                {pdfBlobs.map((pdfItem, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#16a34a', background: '#f0fdf4', padding: '8px 12px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileText size={20} />
                      <span><strong>¡PDF Listo!</strong> {pdfItem.name}.pdf ({Math.round(pdfItem.blob.size / 1024)} KB)</span>
                    </div>
                    <button 
                      onClick={() => handleRemovePdf(index)}
                      style={{ padding: '4px 8px', background: '#ffffff', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                      title="Eliminar este PDF"
                    >
                      <Trash2 size={14} /> Eliminar
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
                  <div className="file-input-wrapper">
                    <label className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', padding: '6px 12px' }}>
                      <UploadCloud size={16} /> Agregar otro PDF
                      <input type="file" accept=".pdf" multiple style={{ display: 'none' }} onChange={handleManualPdfUpload} />
                    </label>
                  </div>
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
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <strong style={{ width: '120px' }}>Correo Cliente:</strong> 
                <input 
                  type="email" 
                  value={emailTo} 
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="Correo del cliente"
                  style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '14px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <strong style={{ width: '120px' }}>Asunto:</strong> <span style={{ color: '#475569' }}>Your Translation is ready!</span>
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
          <button className="btn-secondary" onClick={onBack} style={{ marginRight: 'auto', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={18} style={{ marginRight: '8px' }} /> Volver
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSend} disabled={pdfBlobs.length === 0}>
            <Send size={18} style={{ marginRight: '8px', flexShrink: 0 }} /> Enviar Correo Final
          </button>
        </div>
      </div>
    </div>
  );
}
