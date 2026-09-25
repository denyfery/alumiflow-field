import { createContext, useContext, type ReactNode } from 'react';
import { fieldTheme, type FieldTheme } from '@/ui/theme';

const FieldThemeContext = createContext<FieldTheme>(fieldTheme);

export function FieldThemeProvider({ children }: { children: ReactNode }) {
  return <FieldThemeContext.Provider value={fieldTheme}>{children}</FieldThemeContext.Provider>;
}

export function useFieldTheme(): FieldTheme {
  return useContext(FieldThemeContext);
}
