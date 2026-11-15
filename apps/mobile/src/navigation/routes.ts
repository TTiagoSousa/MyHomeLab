import { createNavigationContainerRef } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParams = {
  Assistant: undefined;
  QuickLog: undefined;
};

export type ScreenProps<Name extends keyof RootStackParams> = NativeStackScreenProps<RootStackParams, Name>;

export const navigationRef = createNavigationContainerRef<RootStackParams>();
