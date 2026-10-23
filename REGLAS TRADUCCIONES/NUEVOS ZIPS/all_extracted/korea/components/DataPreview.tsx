
import React from 'react';
import { ExtractedData } from '../types';
import { Info, Copy, Hash } from 'lucide-react';

interface DataPreviewProps {
  data: ExtractedData;
  onChange: (newData: ExtractedData) => void;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, onChange }) => {
  const handleInputChange = (key: string, value: string) => {
    onChange({ ...data, [key]: value || "" });
  };

  const copy = (txt: string) => navigator.clipboard.writeText(txt);

  const fieldLabels: Record<string, { label: string, tag: string }> = {
    assignedNumber: { label: "Assigned Number (Reference)", tag: "{{assignedNumber}}" },
    surname: { label: "Surname (English)", tag: "{{surname}}" },
    firstName: { label: "First Name (English)", tag: "{{firstName}}" },
    middleName: { label: "Middle Name (English)", tag: "{{middleName}}" },
    dateOfBirth: { label: "Date of Birth (Parsed from Resident No.)", tag: "{{dateOfBirth}}" },
    registration: { label: "Registration (After Hyphen)", tag: "{{registration}}" },
    serial: { label: "Serial (Under Photo)", tag: "{{serial}}" },
    period: { label: "Period (Aptitude to Period)", tag: "{{period}}" },
    licenseNumber: { label: "License Number", tag: "{{licenseNumber}}" },
    placeOfBirth: { label: "Place of Birth (English)", tag: "{{placeOfBirth}}" },
    issueDate: { label: "Issue Date", tag: "{{issueDate}}" },
    authority: { label: "Authority (English)", tag: "{{authority}}" },
    class: { label: "Categories", tag: "{{class}}" },
    explicacionCodigos: { label: "Restrictions & Conditions", tag: "{{explicacionCodigos}}" },
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Review Extracted Data</h3>
            <p className="text-[11px] text-slate-500">Verify Korean specific fields before generating Word.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
            <Info size={12} /> KOREA LICENSE MODE
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {Object.entries(fieldLabels).map(([key, item]) => {
              const isFullWidth = key === 'explicacionCodigos' || key === 'period';
              const isAssignedNum = key === 'assignedNumber';
              const isSpecialField = ['registration', 'serial', 'period', 'dateOfBirth'].includes(key);
              
              return (
                <div key={key} className={`group flex flex-col gap-1.5 ${isFullWidth ? 'md:col-span-2' : ''} ${isAssignedNum ? 'md:col-span-2 bg-red-50/30 p-4 rounded-2xl border border-red-100 mb-2' : ''} ${isSpecialField ? 'border-l-2 border-amber-300 pl-4 bg-amber-50/20' : ''}`}>
                  <div className="flex items-center justify-between">
                    <label className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isAssignedNum ? 'text-red-600' : (isSpecialField ? 'text-amber-600' : 'text-slate-400')}`}>
                      {isAssignedNum && <Hash size={12} />} {item.label}
                    </label>
                    <button 
                      onClick={() => copy(item.tag)}
                      className="opacity-0 group-hover:opacity-100 text-[9px] font-bold text-indigo-500 hover:text-indigo-700 transition-all flex items-center gap-1"
                    >
                      <Copy size={10} /> {item.tag}
                    </button>
                  </div>
                  {key === 'explicacionCodigos' ? (
                    <textarea
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold text-slate-700 placeholder:text-slate-300 resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={data[key as keyof ExtractedData] || ''}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold placeholder:text-slate-300 ${isAssignedNum ? 'bg-white border-red-300 text-red-700 text-lg shadow-sm' : (isSpecialField ? 'bg-amber-50/40 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-700')}`}
                      placeholder="Not detected"
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
