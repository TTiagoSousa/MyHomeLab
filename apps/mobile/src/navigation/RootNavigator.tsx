import { ActivityIndicator, StyleSheet, View, useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { MenuProvider } from '../context/MenuContext';
import { UpdateProvider } from '../context/UpdateContext';
import LoginScreen from '../screens/login/LoginScreen';
import AssistantScreen from '../screens/assistant/AssistantScreen';
import QuickLogScreen from '../screens/quicklog/QuickLogScreen';
import { useColors } from '../theme/useColors';
import { navigationRef, type RootStackParams } from './routes';
import SideMenu from './SideMenu';

const Stack = createNativeStackNavigator<RootStackParams>();

const RootNavigator = () => {
  const { status } = useAuth();
  const colors = useColors();
  const scheme = useColorScheme();

  if (status === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (status === 'signedOut') return <LoginScreen />;

  const base: Theme = scheme === 'light' ? DefaultTheme : DarkTheme;
  const theme: Theme = {
    ...base,
    colors: { ...base.colors, background: colors.background, card: colors.surface, text: colors.text, primary: colors.accent },
  };

  return (
    <UpdateProvider>
      <MenuProvider>
        <NavigationContainer ref={navigationRef} theme={theme}>
          <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name='Assistant' component={AssistantScreen} />
            <Stack.Screen name='QuickLog' component={QuickLogScreen} />
          </Stack.Navigator>
        </NavigationContainer>
        <SideMenu />
      </MenuProvider>
    </UpdateProvider>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default RootNavigator;
