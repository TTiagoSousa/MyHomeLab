import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../../theme/useColors';

interface QuickCardProps {
  title: string;
  summary?: string | null;
  children: ReactNode;
}

const QuickCard = ({ title, summary, children }: QuickCardProps) => {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {summary ? <Text style={[styles.summary, { color: colors.accent }]}>{summary}</Text> : null}
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  summary: { fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});

export default QuickCard;
