import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useColors } from '../theme/useColors';

interface ToastProps {
  message: string | null;
  onHide: () => void;
}

const VISIBLE_MS = 1800;

const Toast = ({ message, onHide }: ToastProps) => {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onHide());
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents='none'
      style={[styles.toast, { backgroundColor: colors.surfaceHigh, borderColor: colors.border, opacity }]}
    >
      <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 32,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  text: { fontSize: 15, fontWeight: '600' },
});

export default Toast;
