import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ChatEntry } from '../../api/types';
import { useColors } from '../../theme/useColors';

const ChatBubble = ({ entry }: { entry: ChatEntry }) => {
  const { t } = useTranslation();
  const colors = useColors();
  const mine = entry.role === 'user';

  return (
    <View style={[styles.row, mine ? styles.mine : styles.theirs]}>
      <Text style={[styles.author, { color: mine ? colors.textSoft : colors.accent }]}>
        {mine ? t('assistant.you') : t('assistant.title')}
      </Text>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.accentSoft, borderTopRightRadius: 4 }
            : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderTopLeftRadius: 4 },
        ]}
      >
        <Text selectable style={[styles.text, { color: colors.text }]}>
          {entry.content}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { maxWidth: '88%', gap: 4, marginVertical: 6 },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  author: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, marginHorizontal: 6 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  text: { fontSize: 16, lineHeight: 23 },
});

export default ChatBubble;
