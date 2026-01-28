import React, { useState, useCallback, useRef } from 'react';
import { UIField, FieldType } from '../types';

/**
 * @fileoverview Generative UI Component Factory.
 * 
 * DESIGN PATTERN:
 * This component acts as a polymorphic factory that hydrates abstract 
 * JSON schema definitions (returned by the Gemini 3 model) into 
 * concrete, interactive React UI elements.
 * 
 * UX STRATEGY:
 * - Emphasizes "Visual Affordance" for file inputs to encourage multimodal usage.
 * - Uses local drag-and-drop state to provide immediate visual feedback 
 *   before committing data to the parent form state.
 * - MOTION: Implements staggered entry animations (via index prop) for 
 *   premium fluid dynamics.
 */

interface DynamicFieldProps {
  field: UIField;
  value: any;
  onChange: (id: string, value: any, file?: File) => void;
  index?: number; // Added for staggered animation calculation
}

/**
 * Visual micro-interaction component for empty file states.
 * Creates a playful, layered aesthetic to reduce "form fatigue".
 */
const FileIcons = () => (
  <div className="flex items-center -space-x-4">
    <div className="w-12 h-12 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-300 group-hover:text-violet-500 group-hover:scale-110 transition-all duration-500 shadow-sm transform -rotate-6">
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-violet-500 group-hover:scale-110 transition-all duration-500 shadow-sm z-10 transform rotate-6">
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
  </div>
);

export const DynamicField: React.FC<DynamicFieldProps> = ({ field, value, onChange, index = 0 }) => {
  const [isDragging, setIsDragging] = useState(false);
  // Ref used to trigger the hidden file input programmatically
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Shared styling tokens for consistent design system application
  const baseClasses = "w-full p-5 border-2 border-slate-100 rounded-2xl focus:ring-[14px] focus:ring-violet-400/10 focus:border-violet-400 outline-none focus:outline-none transition-all bg-slate-50 focus:bg-white text-slate-900 shadow-sm font-bold hover:border-slate-300 text-lg placeholder:text-slate-300";
  const labelClasses = "block text-lg font-black text-slate-800 mb-3 flex items-center gap-2 tracking-tight";

  // Native HTML Drag-and-Drop API handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    // Automatically extract the first file to simplify the mental model for the user
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      onChange(field.id, file.name, file);
    }
  }, [field.id, onChange]);

  /**
   * Factory method to render specific input types based on LLM inference.
   */
  const renderInput = () => {
    switch (field.type) {
      case FieldType.TEXTAREA:
        return (
          <textarea
            className={`${baseClasses} min-h-[140px] leading-relaxed`}
            placeholder={field.placeholder || "Provide detailed input..."}
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
          />
        );
      case FieldType.FILE:
        return (
          <div 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer relative group border-2 border-dashed rounded-2xl transition-all duration-500 overflow-hidden ${
              isDragging 
                ? 'border-violet-500 bg-violet-100 scale-[1.02] shadow-2xl z-20' 
                : value 
                  ? 'border-violet-400 bg-violet-50/20' 
                  : 'border-slate-200 bg-slate-50 hover:border-violet-400 hover:bg-violet-50/50'
            }`}
          >
            {/* Hidden Input controlled via Ref */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onChange(field.id, file.name, file);
              }}
            />
            
            <div className="p-8 flex flex-col items-center justify-center text-center transform transition-all group-hover:scale-[1.01]">
              {value ? (
                // State: File Attached
                <div className="animate-scaleIn flex items-center justify-between w-full gap-5">
                   <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-violet-500 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div className="text-left">
                        <p className="text-lg font-black text-slate-900 truncate max-w-[200px] sm:max-w-[280px]">{value}</p>
                        <p className="text-[12px] text-violet-600 font-black uppercase tracking-widest mt-0.5">Reference attached</p>
                      </div>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        onChange(field.id, null); 
                        // Reset the input value so the same file can be selected again if needed
                        if(fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="w-10 h-10 bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full flex items-center justify-center shadow-sm border border-slate-200 transition-all z-30 shrink-0"
                    title="Remove file"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                // State: Empty / Dragging
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-6">
                    <FileIcons />
                    <div className="text-left">
                      <p className="text-lg font-black text-slate-900 group-hover:text-violet-600 transition-colors">
                        {isDragging ? 'Drop it here!' : 'Attach document or image'}
                      </p>
                      <p className="text-[12px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Drag & Drop or Click</p>
                    </div>
                  </div>
                  {isDragging && (
                     <div className="animate-pulse flex items-center gap-2 text-violet-600 font-black text-xs uppercase tracking-widest">
                        <span className="w-2 h-2 rounded-full bg-violet-600"></span>
                        Ready to receive
                     </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      case FieldType.SELECT:
        return (
          <div className="relative">
            <select
              className={`${baseClasses} appearance-none pr-14 focus:outline-none`}
              value={value || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
            >
              <option value="" disabled>Select option...</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-6 text-slate-400">
              <svg className="h-6 w-6 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
            </div>
          </div>
        );
      default:
        // Default fallthrough for TEXT, NUMBER, DATE types
        return (
          <input
            type={field.type}
            className={baseClasses}
            placeholder={field.placeholder}
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
          />
        );
    }
  };

  /**
   * MOTION DESIGN: Stagger Calculation
   * We apply a base animation delay multiplied by the index.
   * This creates the "waterfall" effect where fields slide in one by one.
   */
  const staggerDelay = `${index * 120}ms`;

  return (
    <div 
      className="group animate-fadeIn" 
      style={{ animationDelay: staggerDelay }}
    >
      <label className={labelClasses}>
        {field.label}
        {field.required && <span className="text-fuchsia-500 ml-1 font-black transform scale-125">!</span>}
      </label>
      {/* 
        AI-Reasoning Tooltip:
        Displays the model's 'why' (description field) directly to the user,
        building trust in the context-gathering process.
      */}
      {field.description && (
        <div className="flex gap-4 mb-4 p-5 bg-violet-50/50 rounded-2xl border border-violet-100 items-start">
          <div className="w-2.5 h-2.5 rounded-full bg-violet-400 mt-2 shrink-0"></div>
          <p className="text-[13px] text-slate-600 leading-relaxed font-bold tracking-tight">{field.description}</p>
        </div>
      )}
      {renderInput()}
    </div>
  );
};