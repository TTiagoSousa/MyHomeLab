import { useColorScheme } from 'react-native';
import { darkPalette, lightPalette } from './palette';

export const useColors = () => (useColorScheme() === 'light' ? lightPalette : darkPalette);
