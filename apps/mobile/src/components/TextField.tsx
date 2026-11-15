import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useColors } from '../theme/useColors';

interface TextFieldProps extends TextInputProps {
  label: string;
  trailing?: ReactNode;
}

const TextField = ({ label, trailing, style, ...props }: TextFieldProps) => {
  const colors = useColors();
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.textSoft }]}>{label}</Text>
      <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <TextInput
          placeholderTextColor={colors.textSoft}
          style={[styles.input, { color: colors.text }, style]}
          {...props}
        />
        {trailing}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  box: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, minHeight: 52, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
});

export default TextField;
