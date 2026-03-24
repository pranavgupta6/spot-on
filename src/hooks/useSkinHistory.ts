import { useState, useCallback, useEffect } from 'react';

export interface ScanHistoryEntry {
  id: string;
  timestamp: number;
  condition: string;
  confidence: 'High' | 'Medium' | 'Low';
  severity: 'Mild' | 'Moderate' | 'Severe';
  seeDoctor: boolean;
  description: string;
  recommendations: string[];
  thumbnailDataUrl?: string;
}

const STORAGE_KEY = 'spoton_history';

export default function useSkinHistory() {
  const [history, setHistory] = useState<ScanHistoryEntry[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Save to localStorage whenever history changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.warn('Failed to save history to localStorage:', error);
    }
  }, [history]);

  const addEntry = useCallback((entry: Omit<ScanHistoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: ScanHistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    setHistory(prev => [newEntry, ...prev]); // Prepend (newest first)
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setHistory(prev => prev.filter(entry => entry.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    history,
    addEntry,
    deleteEntry,
    clearHistory,
  };
}