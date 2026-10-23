
import React from 'react';
import { ExtractedData } from '../types';
import { Info, Hash } from 'lucide-react';

interface DataPreviewProps {
  data: ExtractedData;
  onChange: (newData: ExtractedData) => void;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, onChange }) => {
  const handleInputChange = (key: string, value: string) => {
    onChange({ ...data, [key]: value || "" });
  };

  const fieldLabels: Record<string, { label: string }> = {
    assignedNumber: { label: "Assigned Number (B1234)" },
    surname: { label: "1: Surname" },
    firstName: { label: "2: First Name" },
    middleName: { label: "2: Middle Name" },
    parents: { label: "Filiação (Name of Parents)" },
    licenseNumber: { label: "Nº Registro (Center)" },
    cardNumber: { label: "Card Number (Vertical Left)" },
    idDocument: { label: "4c: Doc Identidade" },
    cpf: { label: "4d: CPF" },
    firstObtained: { label: "1ª Habilitação" },
    conditions: { label: "12: Conditions / Restrictions" },
    dateOfBirth: { label: "3: Date of Birth" },
    placeOfBirth: { label: "3: Place of Birth" },
    issueDate: { label: "4a: Issue Date" },
    authority: { label: "4c: Authority" },
    categoriesDates: { label: "10: Categories Dates" },
    expiryDate: { label: "4b: Expiry Date" },
    class: { label: "9: Categories" },
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Review Extracted Data</h3>
            <p className="text-[11px] text-slate-500">Verify Brazilian CNH data before generating Word.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
            <Info size={12} /> CNH BRAZIL MODE
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {Object.entries(fieldLabels).map(([key, item]) => {
              const isFullWidth = key === 'parents' || key === 'conditions';
              const isAssignedNum = key === 'assignedNumber';
              const isCNHSpecial = ['cardNumber', 'idDocument', 'cpf', 'parents'].includes(key);
              
              return (
                <div key={key} className={`flex flex-col gap-1.5 ${isFullWidth ? 'md:col-span-2' : ''} ${isAssignedNum ? 'md:col-span-2 bg-red-50/30 p-4 rounded-2xl border border-red-100 mb-2' : ''} ${isCNHSpecial && !isFullWidth ? 'border-l-2 border-emerald-100 pl-4' : ''}`}>
                  <label className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isAssignedNum ? 'text-red-600' : (isCNHSpecial ? 'text-emerald-600' : 'text-slate-400')}`}>
                    {isAssignedNum && <Hash size={12} />} {item.label}
                  </label>
                  <input
                    type="text"
                    value={data[key as keyof ExtractedData] || ''}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold placeholder:text-slate-300 ${isAssignedNum ? 'bg-white border-red-300 text-red-700 text-lg shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700'} ${isCNHSpecial ? 'bg-emerald-50/30 border-emerald-100' : ''}`}
                    placeholder={isAssignedNum ? "Type the assigned number here..." : "Not detected"}
                    autoFocus={isAssignedNum}
                  />
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
