import { useFonts } from 'expo-font';
import {
  NotoKufiArabic_400Regular,
  NotoKufiArabic_500Medium,
  NotoKufiArabic_700Bold,
  NotoKufiArabic_900Black,
} from '@expo-google-fonts/noto-kufi-arabic';
import { Archivo_800ExtraBold, Archivo_900Black } from '@expo-google-fonts/archivo';

/** Loaded once at the root (`app/_layout.tsx`) — every screen just names these families in `theme.ts`. */
export function useBrandFonts() {
  return useFonts({
    NotoKufiArabic_400Regular,
    NotoKufiArabic_500Medium,
    NotoKufiArabic_700Bold,
    NotoKufiArabic_900Black,
    Archivo_800ExtraBold,
    Archivo_900Black,
  });
}
