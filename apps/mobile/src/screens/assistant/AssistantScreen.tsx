import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AppHeader from '../../components/AppHeader';
import ErrorBanner from '../../components/ErrorBanner';
import IconButton from '../../components/IconButton';
import UpdateBanner from '../../components/UpdateBanner';
import { useChat } from '../../hooks/useChat';
import { useColors } from '../../theme/useColors';
import ChatBubble from './ChatBubble';
import ChatEmpty from './ChatEmpty';

const AssistantScreen = () => {
  const { t } = useTranslation();
  const colors = useColors();
  const { messages, loading, thinking, error, clearError, send, reset } = useChat();
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const submit = (text: string) => {
    if (!text.trim() || thinking) return;
    send(text);
    setInput('');
  };

  const confirmReset = () =>
    Alert.alert(t('assistant.newConfirmTitle'), t('assistant.newConfirmText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('assistant.newConfirm'), style: 'destructive', onPress: reset },
    ]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.screen} behavior='padding'>
        <AppHeader
          title={t('assistant.title')}
          right={
            <IconButton
              name='newChat'
              label={t('assistant.new')}
              onPress={confirmReset}
              disabled={!messages.length || thinking}
              color={colors.textSoft}
            />
          }
        />
        <UpdateBanner />
        {error && <ErrorBanner message={error} onClose={clearError} />}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : messages.length === 0 && !thinking ? (
          <ChatEmpty onSuggestion={submit} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(entry) => entry.id}
            renderItem={({ item }) => <ChatBubble entry={item} />}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={
              thinking ? (
                <View style={styles.thinking}>
                  <ActivityIndicator size='small' color={colors.accent} />
                  <Text style={[styles.thinkingText, { color: colors.textSoft }]}>{t('assistant.thinking')}</Text>
                </View>
              ) : undefined
            }
          />
        )}

        <View style={[styles.composer, { borderTopColor: colors.border }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('assistant.placeholder')}
            placeholderTextColor={colors.textSoft}
            multiline
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          />
          <IconButton
            name='send'
            label={t('assistant.send')}
            onPress={() => submit(input)}
            disabled={!input.trim() || thinking}
            color={colors.accent}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 14, paddingVertical: 8 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 6 },
  thinkingText: { fontSize: 15, fontStyle: 'italic' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, padding: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 48, maxHeight: 140, borderWidth: 1, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16 },
});

export default AssistantScreen;
