
import React, { useState, useRef } from 'react';
import { transcribeAudio } from '../services/geminiService';

/**
 * @fileoverview Multimodal Input Control (Audio).
 * 
 * TECHNICAL IMPLEMENTATION:
 * 1. Captures client-side audio using the MediaRecorder API.
 * 2. Buffers stream chunks into a Blob.
 * 3. Converts Blob to Base64.
 * 4. Sends payload to Gemini 3 Flash for high-speed transcription.
 * 
 * WHY FLASH?
 * Gemini 3 Flash is optimized for low-latency, high-volume tasks like 
 * real-time transcription, making it superior to Pro for this specific interaction.
 */

interface DictationButtonProps {
  onTranscribe: (text: string) => void;
  className?: string;
  iconOnly?: boolean; // Kept for compatibility but effectively unused in new visual design
}

export const DictationButton: React.FC<DictationButtonProps> = ({ onTranscribe, className = "" }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Refs to persist recorder instances across re-renders without triggering effects
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        // Convert to Base64 for Gemini API consumption
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          try {
            const base64String = (reader.result as string).split(',')[1];
            const text = await transcribeAudio(base64String, 'audio/webm');
            if (text) {
              onTranscribe(text);
            }
          } catch (error) {
            console.error("Transcription failed", error);
          } finally {
            setIsProcessing(false);
            // Cleanup: Stop all tracks to release microphone hardware
            stream.getTracks().forEach(track => track.stop());
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please allow permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const MicIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
    </svg>
  );

  const StopIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6 animate-pulse">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
    </svg>
  );

  const Spinner = (
    <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
  );

  // States
  const baseClasses = "flex items-center justify-center transition-all duration-300 active:scale-95 shadow-sm border";
  
  // Design: Default matches file upload (Slate/White), Hover is Red. Recording is Red.
  const idleClasses = "bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 border-slate-100 hover:border-red-100";
  const recordingClasses = "bg-red-50 text-red-500 border-red-200 ring-4 ring-red-500/10";
  const processingClasses = "bg-slate-50 text-slate-300 cursor-wait border-slate-100";

  let stateClasses = idleClasses;
  if (isProcessing) stateClasses = processingClasses;
  else if (isRecording) stateClasses = recordingClasses;

  return (
    <button
      type="button"
      onClick={toggleRecording}
      disabled={isProcessing}
      className={`${baseClasses} ${stateClasses} ${className}`}
      title={isRecording ? "Stop recording" : "Dictate with Gemini"}
    >
      {isProcessing ? Spinner : (isRecording ? StopIcon : MicIcon)}
    </button>
  );
};
