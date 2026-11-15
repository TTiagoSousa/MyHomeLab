import { Pressable, StyleSheet } from 'react-native';
import Icon, { type IconName } from './Icon';
import { useColors } from '../theme/useColors';

interface IconButtonProps {
  name: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
}

const IconButton = ({ name, label, onPress, disabled, color }: IconButtonProps) => {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.surfaceHigh }, disabled && styles.disabled]}
    >
      <Icon name={name} color={color ?? colors.text} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
});

export default IconButton;
