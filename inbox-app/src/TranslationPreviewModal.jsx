import React, { useState, useEffect } from 'react';
import { X, Save, Download, ArrowRight, RefreshCw } from 'lucide-react';
import { generateClassDescriptions, generateBrazilClassDescriptions, formatCategoriesDates } from './utils/classDescriptions';
import { getAssignedNumber } from './utils/documentGenerator';

export default function TranslationPreviewModal({ 
  isOpen, 
  onClose, 
  initialData, 
  folderName,
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

      // Auto-populate assignedNumber if missing
      if (!normalized.assignedNumber || normalized.assignedNumber.trim() === '' || normalized.assignedNumber.trim() === '-') {
        if (folderName) {
          normalized.assignedNumber = getAssignedNumber(folderName);
        }
      }

      const isBrazil = (normalized.nationality && normalized.nationality.toLowerCase().includes('brazil')) ||
                       (normalized.authority && normalized.authority.toLowerCase().includes('brazil')) ||
                       Boolean(normalized.cpf && normalized.cpf !== '-') ||
                       Boolean(normalized.idDocument && normalized.idDocument !== '-') ||
                       Boolean(folderName && /brazil|brasil/i.test(folderName));

      // Sync citizen
      const defaultCitizen = (normalized.citizen && normalized.citizen.trim() !== '') 
        ? normalized.citizen 
        : ((normalized.bsn && normalized.bsn.trim() !== '') ? normalized.bsn : '');
      if (defaultCitizen) {
        normalized.citizen = defaultCitizen;
      }

      // Auto-populate classDescriptions if missing, empty, or '-'
      if ((!normalized.classDescriptions || normalized.classDescriptions.trim() === '' || normalized.classDescriptions.trim() === '-') && normalized.class) {
        if (isBrazil) {
          normalized.classDescriptions = generateBrazilClassDescriptions(normalized.class);
        } else {
          normalized.classDescriptions = generateClassDescriptions(normalized.class);
        }
      }

      // Format categoriesDates grouping if present
      if (normalized.categoriesDates && !isBrazil) {
        normalized.categoriesDates = formatCategoriesDates(normalized.categoriesDates);
      }

      // Sync firstObtained and categoriesDates
      if (normalized.firstObtained && (!normalized.categoriesDates || normalized.categoriesDates === '-')) {
        normalized.categoriesDates = normalized.firstObtained;
      } else if (normalized.categoriesDates && (!normalized.firstObtained || normalized.firstObtained === '-')) {
        normalized.firstObtained = normalized.categoriesDates;
      }

      // Sync reference and assignedNumber
      if (normalized.assignedNumber && (!normalized.reference || normalized.reference === '-')) {
        normalized.reference = normalized.assignedNumber;
      } else if (normalized.reference && (!normalized.assignedNumber || normalized.assignedNumber === '-')) {
        normalized.assignedNumber = normalized.reference;
      }

      // Middle name fallback: for Brazil leave empty string "", for other countries '-'
      if (!normalized.middleName || normalized.middleName.trim() === '""' || (isBrazil && normalized.middleName.trim() === '-')) {
        normalized.middleName = isBrazil ? '' : '-';
      }
      
      // Sync codes, explicacionCodigos and conditions
      let condCodes = (normalized.conditions && normalized.conditions.trim() !== '' && normalized.conditions !== '-')
        ? normalized.conditions.trim()
        : ((normalized.explicacionCodigos && normalized.explicacionCodigos.trim() !== '' && normalized.explicacionCodigos !== '-') 
          ? normalized.explicacionCodigos.trim() 
          : ((normalized.codes && normalized.codes.trim() !== '' && normalized.codes !== '-') ? normalized.codes.trim() : '-'));

      if (condCodes !== '-' && normalized.citizen && normalized.citizen !== '-') {
        const cleanCond = condCodes.replace(/[\s\/,-]+/g, '');
        const cleanCit = normalized.citizen.replace(/[\s\/,-]+/g, '');
        if ((cleanCit && (cleanCond === cleanCit || cleanCond.includes(cleanCit))) || /^\d{8,}[\s\/,-]*\d*$/.test(condCodes.trim())) {
          condCodes = '-';
        }
      }

      normalized.codes = condCodes;
      normalized.explicacionCodigos = condCodes;
      normalized.conditions = condCodes;

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
        : ((normalized.point4d && normalized.point4d.trim() !== '') ? normalized.point4d : (normalized.cpf || '-'));
      normalized.personal = sec4d;
      normalized.point4d = sec4d;

      // Sync eye & eyeColor
      const finalEye = (normalized.eye && normalized.eye.trim() !== '') 
        ? normalized.eye 
        : ((normalized.eyeColor && normalized.eyeColor.trim() !== '') ? normalized.eyeColor : (normalized.Eye || ''));
      if (finalEye) {
        normalized.eye = finalEye;
        normalized.eyeColor = finalEye;
      }

      // Sync sex & gender
      const finalSex = (normalized.sex && normalized.sex.trim() !== '') 
        ? normalized.sex 
        : ((normalized.gender && normalized.gender.trim() !== '') ? normalized.gender : '');
      if (finalSex) {
        normalized.sex = finalSex;
        normalized.gender = finalSex;
      }

      // Brazilian fields defaults
      if (!normalized.nationality || normalized.nationality.trim() === '') {
        normalized.nationality = 'Brazilian';
      }

      setFormData(normalized);
    }
  }, [initialData, folderName]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'firstName') updated.firstNames = value;
      if (name === 'firstNames') updated.firstName = value;
      if (name === 'explicacionCodigos') {
        updated.codes = value;
        updated.conditions = value;
      }
      if (name === 'codes') {
        updated.explicacionCodigos = value;
        updated.conditions = value;
      }
      if (name === 'conditions') {
        updated.codes = value;
        updated.explicacionCodigos = value;
      }
      if (name === 'reverse') updated.code = value;
      if (name === 'code') updated.reverse = value;
      if (name === 'blood') updated.Blood = value;
      if (name === 'Blood') updated.blood = value;
      if (name === 'personal') updated.point4d = value;
      if (name === 'point4d') updated.personal = value;
      if (name === 'assignedNumber') updated.reference = value;
      if (name === 'reference') updated.assignedNumber = value;
      if (name === 'firstObtained') updated.categoriesDates = value;
      if (name === 'categoriesDates') updated.firstObtained = value;
      if (name === 'eye') updated.eyeColor = value;
      if (name === 'eyeColor') updated.eye = value;
      if (name === 'sex') updated.gender = value;
      if (name === 'gender') updated.sex = value;
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
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 className="modal-title" style={{ margin: 0 }}>Revisar Datos Extraídos (IA)</h2>
            <span style={{ 
              backgroundColor: '#3b82f6', 
              color: '#ffffff', 
              padding: '4px 12px', 
              borderRadius: '6px', 
              fontWeight: 'bold', 
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              🏷️ DL: {formData.assignedNumber || formData.reference || getAssignedNumber(folderName) || (folderName ? folderName.match(/\b([A-Za-z]?\d{3,6})\b/)?.[0]?.toUpperCase() : '') || 'En Proceso'}
            </span>
            {folderName && <span style={{ fontSize: '13px', color: '#6b7280' }}>({folderName})</span>}
          </div>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Height ({"{{height}}"})</label>
              <input type="text" name="height" value={formData.height || ''} onChange={handleChange} style={inputStyle} placeholder="-" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Eye Color ({"{{eye}}"} / {"{{eyeColor}}"})</label>
              <input type="text" name="eye" value={formData.eye || formData.eyeColor || ''} onChange={handleChange} style={inputStyle} placeholder="-" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Sex / Gender ({"{{sex}}"} / {"{{gender}}"})</label>
              <input type="text" name="sex" value={formData.sex || formData.gender || ''} onChange={handleChange} style={inputStyle} placeholder="-" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Address ({"{{address}}"})</label>
              <input type="text" name="address" value={formData.address || ''} onChange={handleChange} style={inputStyle} placeholder="-" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Reference No. ({"{{reference}}"})</label>
              <input type="text" name="reference" value={formData.reference || ''} onChange={handleChange} style={inputStyle} placeholder="-" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Licence Number</label>
              <input type="text" name="licenseNumber" value={formData.licenseNumber || ''} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Assigned No. ({"{{assignedNumber}}"})</label>
              <input type="text" name="assignedNumber" value={formData.assignedNumber || ''} onChange={handleChange} style={inputStyle} placeholder="ej. B1234" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Card / Espelho No. ({"{{cardNumber}}"})</label>
              <input type="text" name="cardNumber" value={formData.cardNumber || ''} onChange={handleChange} style={inputStyle} placeholder="Nº Espelho (Vertical)" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Doc. Identidade / Sec 4c ({"{{idDocument}}"})</label>
              <input type="text" name="idDocument" value={formData.idDocument || ''} onChange={handleChange} style={inputStyle} placeholder="ej. 392634570 SSP SP" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>CPF / Sec 4d ({"{{cpf}}"})</label>
              <input type="text" name="cpf" value={formData.cpf || ''} onChange={handleChange} style={inputStyle} placeholder="000.000.000-00" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Parents / Filiação ({"{{parents}}"})</label>
              <input type="text" name="parents" value={formData.parents || ''} onChange={handleChange} style={inputStyle} placeholder="Nombres de los padres" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>1ª Habilitação ({"{{firstObtained}}"})</label>
              <input type="text" name="firstObtained" value={formData.firstObtained || ''} onChange={handleChange} style={inputStyle} placeholder="DD Month YYYY" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Nationality ({"{{nationality}}"})</label>
              <input type="text" name="nationality" value={formData.nationality || ''} onChange={handleChange} style={inputStyle} placeholder="Brazilian" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Personal No. / Sec 4d ({"{{personal}}"})</label>
              <input type="text" name="personal" value={formData.personal || formData.point4d || formData.cpf || ''} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Citizen No. / Netherlands Back Top-Left ({"{{citizen}}"})</label>
              <input type="text" name="citizen" value={formData.citizen || ''} onChange={handleChange} style={inputStyle} placeholder="ej. 230773941 / 5899184886" />
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
                  const isBrazil = (formData.nationality && formData.nationality.toLowerCase().includes('brazil')) ||
                                   (formData.authority && formData.authority.toLowerCase().includes('brazil')) ||
                                   Boolean(formData.cpf && formData.cpf !== '-') ||
                                   Boolean(folderName && /brazil|brasil/i.test(folderName));
                  const generated = isBrazil 
                    ? generateBrazilClassDescriptions(formData.class || '') 
                    : generateClassDescriptions(formData.class || '');
                  if (generated) {
                    setFormData(prev => ({ ...prev, classDescriptions: generated }));
                  } else {
                    alert("No se pudieron detectar categorías válidas en 'Licence Class/es Held'. Ingrese categorías como AM, A1, A, B, BE, C, D, E, ACC.");
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
