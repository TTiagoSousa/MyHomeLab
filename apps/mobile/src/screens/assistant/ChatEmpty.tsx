import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import JarvisMark from '../../components/JarvisMark';
import { useColors } from '../../theme/useColors';

const SUGGESTIONS = [
  'assistant.suggestionEmails',
  'assistant.suggestionServers',
  'assistant.suggestionSleep',
  'assistant.suggestionTasks',
];

const ChatEmpty = ({ onSuggestion }: { onSuggestion: (text: string) => void }) => {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <View style={styles.empty}>
      <JarvisMark size={96} />
      <Text style={[styles.title, { color: colors.text }]}>{t('assistant.emptyTitle')}</Text>
      <Text style={[styles.hint, { color: colors.textSoft }]}>{t('assistant.emptyHint')}</Text>
      {SUGGESTIONS.map((key) => (
        <Pressable
          key={key}
          onPress={() => onSuggestion(t(key))}
          style={({ pressed }) => [
            styles.chip,
            { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceHigh : 'transparent' },
          ]}
        >
          <Text style={[styles.chipText, { color: colors.text }]}>{t(key)}</Text>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginTop: 8 },
  hint: { fontSize: 15, textAlign: 'center', marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  chipText: { fontSize: 15 },
});

export default ChatEmpty;
