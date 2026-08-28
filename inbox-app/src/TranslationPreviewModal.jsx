import React, { useState, useEffect } from 'react';
import { X, Save, Download, ArrowRight, RefreshCw } from 'lucide-react';
import { generateClassDescriptions, formatCategoriesDates } from './utils/classDescriptions';

export default function TranslationPreviewModal({ 
  isOpen, 
  onClose, 
  initialData, 
  onSave,
  onDownloadWord
}) {
  const [formData, setFormData] = useState(initialData || {});
  const [templateFile, setTemplateFile] = useState(null);

  useEffect(() => {
    if (initialData) {
      const normalized = {};
      for (const [key, val] of Object.entries(initialData)) {
        if (val === null || val === undefined) {
          normalized[key] = '';
        } else if (typeof val === 'object') {
          if (Array.isArray(val)) {
            normalized[key] = val.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join('\n');
          } else {
            normalized[key] = Object.values(val).filter(Boolean).map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(' ');
          }
        } else {
          normalized[key] = String(val);
        }
      }

      // Auto-populate classDescriptions if missing, empty, or '-'
      if ((!normalized.classDescriptions || normalized.classDescriptions.trim() === '' || normalized.classDescriptions.trim() === '-') && normalized.class) {
        normalized.classDescriptions = generateClassDescriptions(normalized.class);
      }

      // Format categoriesDates grouping if present
      if (normalized.categoriesDates) {
        normalized.categoriesDates = formatCategoriesDates(normalized.categoriesDates);
      }

      // Middle name fallback to '-' if missing or empty
      if (!normalized.middleName || normalized.middleName.trim() === '' || normalized.middleName.trim() === '""') {
        normalized.middleName = '-';
      }
      
      // Sync codes and explicacionCodigos for Conditions
      const condCodes = (normalized.codes && normalized.codes.trim() !== '') 
        ? normalized.codes 
        : ((normalized.explicacionCodigos && normalized.explicacionCodigos.trim() !== '') ? normalized.explicacionCodigos : '-');
      normalized.codes = condCodes;
      normalized.explicacionCodigos = condCodes;

      // Sync firstName and firstNames
      if (normalized.firstName !== undefined && normalized.firstNames === undefined) {
        normalized.firstNames = normalized.firstName;
      } else if (normalized.firstNames !== undefined && normalized.firstName === undefined) {
        normalized.firstName = normalized.firstNames;
      }

      if (normalized.code !== undefined) {
        normalized.reverse = normalized.code;
      } else if (normalized.reverse !== undefined) {
        normalized.code = normalized.reverse;
      }
      
      if (normalized.Blood !== undefined) {
        normalized.blood = normalized.Blood;
      } else if (normalized.blood !== undefined) {
        normalized.Blood = normalized.blood;
      }

      const sec4d = (normalized.personal && normalized.personal.trim() !== '') 
        ? normalized.personal 
        : ((normalized.point4d && normalized.point4d.trim() !== '') ? normalized.point4d : '-');
      normalized.personal = sec4d;
      normalized.point4d = sec4d;

      setFormData(normalized);
    }
  }, [initialData]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'firstName') updated.firstNames = value;
      if (name === 'firstNames') updated.firstName = value;
      if (name === 'explicacionCodigos') updated.codes = value;
      if (name === 'codes') updated.explicacionCodigos = value;
      if (name === 'reverse') updated.code = value;
      if (name === 'code') updated.reverse = value;
      if (name === 'blood') updated.Blood = value;
      if (name === 'Blood') updated.blood = value;
      if (name === 'personal') updated.point4d = value;
      if (name === 'point4d') updated.personal = value;
      if (name === 'categoriesDates') updated.categoriesDates = formatCategoriesDates(value);
      return updated;
    });
  };

  const handleSave = () => {
    if (!templateFile) {
      alert("Por favor, selecciona una plantilla de Word (.docx) primero.");
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      const arrayBuffer = e.target.result;
      onSave(formData, arrayBuffer);
    };
    reader.readAsArrayBuffer(templateFile);
  };

  const handleDownload = () => {
    if (!templateFile) {
      alert("Por favor, selecciona una plantilla de Word (.docx) primero.");
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      const arrayBuffer = e.target.result;
      if (onDownloadWord) {
        onDownloadWord(formData, arrayBuffer);
      }
    };
    reader.readAsArrayBuffer(templateFile);
  };

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2 className="modal-title">Revisar Datos Extraídos (IA)</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, backgroundColor: '#f9fafb' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Surname</label>
              <input type="text" name="surname" value={formData.surname || ''} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>First Name</label>
              <input type="text" name="firstName" value={formData.firstName || ''} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Middle Name ({"{{middleName}}"})</label>
              <input type="text" name="middleName" value={formData.middleName || ''} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          {(formData.fullName !== undefined) && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Full Name (Vietnam etc.)</label>
              <input type="text" name="fullName" value={formData.fullName || ''} onChange={handleChange} style={inputStyle} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Date of Birth</label>
              <input type="text" name="dateOfBirth" value={formData.dateOfBirth || ''} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Place of Birth</label>
              <input type="text" name="placeOfBirth" value={formData.placeOfBirth || ''} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          {(formData.gender !== undefined) && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Gender</label>
              <input type="text" name="gender" value={formData.gender || ''} onChange={handleChange} style={inputStyle} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Licence Number</label>
              <input type="text" name="licenseNumber" value={formData.licenseNumber || ''} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Personal No. / Sec 4d ({"{{personal}}"})</label>
              <input type="text" name="personal" value={formData.personal || formData.point4d || ''} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Issuing Authority</label>
            <input type="text" name="authority" value={formData.authority || ''} onChange={handleChange} style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Date First Obtained ({"{{categoriesDates}}"})</label>
              <textarea name="categoriesDates" value={formData.categoriesDates || ''} onChange={handleChange} style={{...inputStyle, height: '80px'}} />
            </div>
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Date Issued</label>
                <input type="text" name="issueDate" value={formData.issueDate || ''} onChange={handleChange} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Expiry Date</label>
                <input type="text" name="expiryDate" value={formData.expiryDate || ''} onChange={handleChange} style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Licence Class/es Held</label>
            <input type="text" name="class" value={formData.class || ''} onChange={handleChange} style={inputStyle} />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>
                Class Descriptions ({"{{classDescriptions}}"})
              </label>
              <button
                type="button"
                onClick={() => {
                  const generated = generateClassDescriptions(formData.class || '');
                  if (generated) {
                    setFormData(prev => ({ ...prev, classDescriptions: generated }));
                  } else {
                    alert("No se pudieron detectar categorías válidas en 'Licence Class/es Held'. Ingrese categorías como AM, A1, A, B, BE, C, L, T.");
                  }
                }}
                style={{
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #93c5fd',
                  borderRadius: '4px',
                  padding: '3px 10px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ⚡ Auto-generar descripciones
              </button>
            </div>
            <textarea name="classDescriptions" value={formData.classDescriptions || ''} onChange={handleChange} style={{...inputStyle, height: '150px'}} />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>
              Conditions / Condiciones (Codes / {"{{codes}}"} / {"{{explicacionCodigos}}"})
            </label>
            <textarea name="explicacionCodigos" value={formData.explicacionCodigos || ''} onChange={handleChange} style={{...inputStyle, height: '80px'}} />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>
                Japón: Franja Dorada / Excellent Driver ({"{{gold}}"})
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const text = `The issue authority is recognised the licence holder as an excellent driver.\n"Excellent Driver" is one of the categories on a driver's license. It applies to individuals under the age of 70, who have held a license for a continuous period of 5 years or more and have not been involved in any violations or accidents causing injuries.`;
                    setFormData(prev => ({ ...prev, gold: text }));
                  }}
                  style={{
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #f59e0b',
                    borderRadius: '4px',
                    padding: '3px 10px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ⭐ Con Franja Dorada (Excellent Driver)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, gold: '-' }))}
                  style={{
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '3px 10px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ⚪ Sin Franja Dorada (-)
                </button>
              </div>
            </div>
            <textarea 
              name="gold" 
              value={formData.gold || ''} 
              onChange={handleChange} 
              placeholder="Texto para franja dorada o guion (-)..." 
              style={{ ...inputStyle, height: '90px' }} 
            />
            <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
              *(Este campo controla la etiqueta {"{{gold}}"} en tu machote. Usa los botones superiores para cambiar rápidamente)*
            </span>
          </div>

          {(formData.nationality !== undefined || formData.address !== undefined || formData.reverse !== undefined || formData.code !== undefined || formData.blood !== undefined || formData.Blood !== undefined || formData.area !== undefined || formData.file !== undefined || formData.issuedDate !== undefined) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Nationality / Address</label>
                <input type="text" name="address" value={formData.address || formData.nationality || ''} onChange={handleChange} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Area No. ({"{{area}}"})</label>
                <input type="text" name="area" value={formData.area || ''} onChange={handleChange} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>File No. ({"{{file}}"})</label>
                <input type="text" name="file" value={formData.file || formData.code || ''} onChange={handleChange} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Issued Date ({"{{issuedDate}}"})</label>
                <input type="text" name="issuedDate" value={formData.issuedDate || ''} onChange={handleChange} style={inputStyle} />
              </div>
            </div>
          )}

        </div>

        <div style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5e7eb' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>
              Plantilla Word (.docx)
            </label>
            <input 
              type="file" 
              accept=".docx" 
              onChange={(e) => setTemplateFile(e.target.files[0])} 
              style={{ fontSize: '13px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-secondary" onClick={handleDownload} style={{ display: 'flex', alignItems: 'center' }}>
              <Download size={18} style={{ marginRight: '8px' }} /> Descargar Word
            </button>
            <button className="btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center' }}>
              Continuar a Enviar <ArrowRight size={18} style={{ marginLeft: '8px' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '4px',
  border: '1px solid #d1d5db',
  fontSize: '14px'
};
