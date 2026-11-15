import { Pressable, StyleSheet, Text } from 'react-native';
import { useColors } from '../../theme/useColors';

interface QuickButtonProps {
  label: string;
  hint?: string | null;
  onPress: () => void;
  disabled?: boolean;
}

const longestWord = (text: string) => Math.max(...text.split(/s+/).map((word) => word.length));

const QuickButton = ({ label, hint, onPress, disabled }: QuickButtonProps) => {
  const colors = useColors();
  const fontSize = longestWord(label) > 10 ? 14 : 16;
  return (
    <Pressable
      accessibilityRole='button'
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.accentSoft, borderColor: colors.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[styles.label, { color: colors.text, fontSize }]}
        numberOfLines={2}
        android_hyphenationFrequency='normal'
      >
        {label}
      </Text>
      {hint ? (
        <Text style={[styles.hint, { color: colors.textSoft }]} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: { flexGrow: 1, flexBasis: '30%', minHeight: 64, borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 10, justifyContent: 'center', alignItems: 'center', gap: 2 },
  label: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  hint: { fontSize: 12 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});

export default QuickButton;
