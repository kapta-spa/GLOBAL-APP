
import React from 'react';
import { ExtractedData } from '../types';
import { Info, Copy, Hash } from 'lucide-react';

interface DataPreviewProps {
  data: ExtractedData;
  onChange: (newData: ExtractedData) => void;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, onChange }) => {
  const handleInputChange = (key: string, value: string) => {
    const updated = { ...data, [key]: value || "" };
    if (key === 'fullname') {
      updated.fullName = value || "";
    } else if (key === 'fullName') {
      updated.fullname = value || "";
    }
    onChange(updated);
  };

  const copy = (txt: string) => navigator.clipboard.writeText(txt);

  const fieldLabels: Record<string, { label: string, tag: string }> = {
    assignedNumber: { label: "Assigned Number (File Name & Bold/Red)", tag: "{{assignedNumber}}" },
    fullname: { label: "Full Name (Nombre)", tag: "{{fullname}}" },
    gender: { label: "Gender (Male / Female)", tag: "{{gender}}" },
    reverse: { label: "Reverse Number (Número del Reverso, ej: AV934767)", tag: "{{reverse}}" },
    nationality: { label: "Nationality (Nacionalidad)", tag: "{{nationality}}" },
    address: { label: "Address (Dirección)", tag: "{{address}}" },
    classDescriptions: { label: "Classification of Motor Vehicles (Reverso)", tag: "{{classDescriptions}}" },
    categoriesDates: { label: "Beginning Date (Trúng tuyển ngày / Reverso)", tag: "{{categoriesDates}}" },
    licenseNumber: { label: "License Number (Số / No.)", tag: "{{licenseNumber}}" },
    dateOfBirth: { label: "Date of Birth", tag: "{{dateOfBirth}}" },
    issueDate: { label: "Issue Date", tag: "{{issueDate}}" },
    expiryDate: { label: "Expiry Date", tag: "{{expiryDate}}" },
    class: { label: "Class (Hạng)", tag: "{{class}}" },
    authority: { label: "Authority", tag: "{{authority}}" },
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Review Extracted Data - Vietnam License</h3>
            <p className="text-[11px] text-slate-500">Assign a number and verify translation before generating Word.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
            <Info size={12} /> VIETNAM TRANSLATION MODE
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {Object.entries(fieldLabels).map(([key, item]) => {
              const isTextArea = key === 'classDescriptions' || key === 'address';
              const isAssignedNum = key === 'assignedNumber';
              const isHighlight = key === 'fullname' || key === 'reverse';
              
              const currentVal = data[key as keyof ExtractedData] || (key === 'fullname' ? data.fullName : '') || '';

              return (
                <div key={key} className={`group flex flex-col gap-1.5 ${isTextArea ? 'md:col-span-2' : ''} ${isAssignedNum ? 'md:col-span-2 bg-red-50/30 p-4 rounded-2xl border border-red-100 mb-2' : ''} ${isHighlight ? 'border-l-2 border-indigo-400 pl-4' : ''}`}>
                  <div className="flex items-center justify-between">
                    <label className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isAssignedNum ? 'text-red-600' : (isHighlight ? 'text-indigo-600' : 'text-slate-400')}`}>
                      {isAssignedNum && <Hash size={12} />} {item.label}
                    </label>
                    <button 
                      onClick={() => copy(item.tag)}
                      className="opacity-0 group-hover:opacity-100 text-[9px] font-bold text-indigo-500 hover:text-indigo-700 transition-all flex items-center gap-1"
                    >
                      <Copy size={10} /> {item.tag}
                    </button>
                  </div>
                  {isTextArea ? (
                    <textarea
                      value={currentVal}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-indigo-50/30 border border-indigo-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold text-slate-700 placeholder:text-slate-300 resize-none"
                      placeholder="Enter details..."
                    />
                  ) : (
                    <input
                      type="text"
                      value={currentVal}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold placeholder:text-slate-300 ${isAssignedNum ? 'bg-white border-red-300 text-red-700 text-lg shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                      placeholder={isAssignedNum ? "Type the assigned number here (e.g. B1758)..." : "Not detected"}
                      autoFocus={isAssignedNum}
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
