import { createContext, useContext } from 'react';
import { reasoningPreset } from './reasoningPreferences';
import type { ReasoningPreferences } from './reasoningPreferences';

export const ReasoningPreferencesContext = createContext<ReasoningPreferences>(reasoningPreset());
export const useReasoningPreferences = () => useContext(ReasoningPreferencesContext);
