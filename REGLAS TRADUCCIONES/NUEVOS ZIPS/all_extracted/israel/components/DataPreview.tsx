
import React, { useState } from 'react';
import { ExtractedData } from '../types';
import { Info, Copy, Check, Hash, Sparkles } from 'lucide-react';

interface DataPreviewProps {
  data: ExtractedData;
  onChange: (newData: ExtractedData) => void;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, onChange }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleInputChange = (key: string, value: string) => {
    onChange({ ...data, [key]: value || "" });
  };

  const copy = (key: string, txt: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fieldLabels: Record<string, { label: string, tag: string, desc?: string }> = {
    assignedNumber: { 
      label: "Número de Referencia Asignado", 
      tag: "{{assignedNumber}}",
      desc: "Opcional: Si se define, se usará como nombre del archivo generado"
    },
    surname: { label: "1. Apellidos (Surname)", tag: "{{surname}}" },
    firstName: { label: "2. Primer Nombre (First Name)", tag: "{{firstName}}" },
    middleName: { label: "2. Segundo Nombre (Middle Name)", tag: "{{middleName}}" },
    licenseNumber: { label: "5. Número de Licencia (License No.)", tag: "{{licenseNumber}}" },
    dateOfBirth: { label: "3. Fecha de Nacimiento (DOB)", tag: "{{dateOfBirth}}" },
    placeOfBirth: { label: "3. Lugar de Nacimiento (Place of Birth)", tag: "{{placeOfBirth}}" },
    issueDate: { label: "4a. Fecha de Emisión (Issue Date)", tag: "{{issueDate}}" },
    expiryDate: { label: "4b. Fecha de Expiración (Expiry Date)", tag: "{{expiryDate}}" },
    authority: { label: "4c. Autoridad Emisora (Authority)", tag: "{{authority}}" },
    personal: { label: "4d. Código Personal (Personal ID)", tag: "{{personal}}" },
    code: { label: "Debajo 4d. Cuatro Números (Code)", tag: "{{code}}" },
    class: { label: "9. Categorías Frente (Classes)", tag: "{{class}}" },
    first: { label: "Reverso: Año Primera Categoría (Year)", tag: "{{first}}" },
    categoriesDates: { label: "10/11. Fechas por Categoría (Reverso)", tag: "{{categoriesDates}}" },
    explicacionCodigos: { 
      label: "12. Restricciones y Condiciones (Columna 12 Reverso)", 
      tag: "{{explicacionCodigos}}",
      desc: "Traducción y explicación en inglés de los códigos (ej. 01, 70, 106)"
    },
  };

  return (
    <div className="space-y-6">
      <div className="bg-brand-dark/80 border border-white/10 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 bg-white/[0.03] flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-brand-cyan" />
              <h3 className="font-bold text-white text-base sm:text-lg tracking-tight">
                Datos Extraídos por IA
              </h3>
            </div>
            <p className="text-xs text-white/60 mt-0.5">
              Revisa y edita los campos traducidos al inglés antes de exportar el documento Word.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-cyan bg-brand-cyan/10 px-3.5 py-1.5 rounded-full border border-brand-cyan/30">
            <Info size={14} /> Edición Habilitada
          </div>
        </div>

        {/* Content Fields */}
        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {Object.entries(fieldLabels).map(([key, item]) => {
              const isFullWidth = key === 'explicacionCodigos';
              const isAssignedNum = key === 'assignedNumber';
              const isCopied = copiedKey === key;
              const value = data[key as keyof ExtractedData] || '';
              
              return (
                <div 
                  key={key} 
                  className={`flex flex-col gap-2 ${
                    isFullWidth ? 'md:col-span-2' : ''
                  } ${
                    isAssignedNum 
                      ? 'md:col-span-2 bg-brand-cyan/[0.07] p-5 rounded-2xl border border-brand-cyan/30 mb-2' 
                      : 'bg-white/[0.02] p-3.5 sm:p-4 rounded-2xl border border-white/[0.07]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <label className={`text-xs font-bold flex items-center gap-1.5 ${
                      isAssignedNum ? 'text-brand-cyan text-sm' : 'text-white/80'
                    }`}>
                      {isAssignedNum && <Hash size={14} />} 
                      {item.label}
                    </label>

                    <button 
                      type="button"
                      onClick={() => copy(key, item.tag)}
                      title="Copiar etiqueta para plantilla docx"
                      className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-brand-cyan/20 border border-white/10 hover:border-brand-cyan/40 text-[11px] font-mono font-semibold text-brand-cyan/90 transition-colors flex items-center gap-1"
                    >
                      {isCopied ? (
                        <>
                          <Check size={11} className="text-emerald-400" />
                          <span className="text-emerald-400 font-sans">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>{item.tag}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {item.desc && (
                    <p className="text-[11px] text-white/50">{item.desc}</p>
                  )}

                  {isFullWidth ? (
                    <textarea
                      value={value}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-black/40 border border-white/15 rounded-xl text-sm focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition-all font-medium text-white placeholder:text-white/20 resize-y"
                      placeholder="Ningún código o restricción detectada."
                    />
                  ) : (
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className={`w-full px-4 py-2.5 sm:py-3 border rounded-xl text-sm focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none transition-all font-medium placeholder:text-white/20 ${
                        isAssignedNum 
                          ? 'bg-black/50 border-brand-cyan/40 text-brand-cyan text-base font-bold' 
                          : 'bg-black/40 border-white/15 text-white'
                      }`}
                      placeholder={isAssignedNum ? "Ej: REF-2026-001" : "No detectado"}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataPreview;

