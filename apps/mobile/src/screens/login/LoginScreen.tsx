import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import IconButton from '../../components/IconButton';
import JarvisMark from '../../components/JarvisMark';
import PrimaryButton from '../../components/PrimaryButton';
import TextField from '../../components/TextField';
import { ApiError } from '../../api/client';
import { errorText } from '../../api/errorText';
import { useAuth } from '../../context/AuthContext';
import { useColors } from '../../theme/useColors';
import { isInsecureServer } from '../../utils/insecureServer';

const LoginScreen = () => {
  const { t } = useTranslation();
  const colors = useColors();
  const { server: savedServer, lastUsername, signIn } = useAuth();
  const [server, setServer] = useState(savedServer);
  const [username, setUsername] = useState(lastUsername);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setServer(savedServer);
    setUsername(lastUsername);
  }, [savedServer, lastUsername]);

  const submit = async () => {
    if (!username.trim() || !password) {
      setError(t('login.errorMissing'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(server, username, password);
    } catch (signInError) {
      setError(
        signInError instanceof ApiError && signInError.status === 401
          ? t('login.errorCredentials')
          : errorText(signInError),
      );
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps='handled'>
          <JarvisMark size={88} centered />
          <Text style={[styles.title, { color: colors.text }]}>{t('login.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSoft }]}>{t('login.subtitle')}</Text>

          <TextField
            label={t('login.server')}
            value={server}
            onChangeText={setServer}
            placeholder={t('login.serverHint')}
            autoCapitalize='none'
            autoCorrect={false}
            keyboardType='url'
            returnKeyType='next'
          />
          {isInsecureServer(server) && (
            <Text style={[styles.warning, { color: colors.danger }]}>{t('login.insecureServer')}</Text>
          )}
          <TextField
            label={t('login.username')}
            value={username}
            onChangeText={setUsername}
            autoCapitalize='none'
            autoCorrect={false}
            autoComplete='username'
            returnKeyType='next'
          />
          <TextField
            label={t('login.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize='none'
            autoComplete='password'
            returnKeyType='go'
            onSubmitEditing={submit}
            trailing={
              <IconButton
                name={showPassword ? 'eyeOff' : 'eye'}
                label={t(showPassword ? 'login.hidePassword' : 'login.showPassword')}
                onPress={() => setShowPassword(!showPassword)}
                color={colors.textSoft}
              />
            }
          />

          {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

          <PrimaryButton label={t('login.submit')} onPress={submit} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 8 },
  error: { fontSize: 15, textAlign: 'center' },
  warning: { fontSize: 14, marginTop: -8 },
});

export default LoginScreen;
