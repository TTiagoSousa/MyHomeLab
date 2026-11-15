import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon, { type IconName } from './Icon';
import { useColors } from '../theme/useColors';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'solid' | 'outline' | 'text' | 'danger';
}

const PrimaryButton = ({ label, onPress, icon, loading, disabled, variant = 'solid' }: PrimaryButtonProps) => {
  const colors = useColors();
  const solid = variant === 'solid';
  const foreground =
    variant === 'solid' ? colors.onAccent : variant === 'danger' ? colors.danger : colors.accent;

  return (
    <Pressable
      accessibilityRole='button'
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        solid && { backgroundColor: colors.accent },
        variant === 'outline' && { borderWidth: 1, borderColor: colors.border },
        variant !== 'solid' && variant !== 'outline' && styles.flat,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={foreground} />
        ) : (
          icon && <Icon name={icon} color={foreground} size={22} />
        )}
        <Text style={[styles.label, { color: foreground }]}>{label}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: 26, paddingHorizontal: 22, justifyContent: 'center' },
  flat: { minHeight: 44, paddingHorizontal: 12 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  label: { fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
});

export default PrimaryButton;
