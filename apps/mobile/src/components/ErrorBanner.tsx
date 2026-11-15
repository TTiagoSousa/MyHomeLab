import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import IconButton from './IconButton';
import { useColors } from '../theme/useColors';

interface ErrorBannerProps {
  message: string;
  onClose?: () => void;
}

const ErrorBanner = ({ message, onClose }: ErrorBannerProps) => {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={[styles.banner, { backgroundColor: colors.dangerSoft }]}>
      <Text style={[styles.text, { color: colors.danger }]}>{message}</Text>
      {onClose && <IconButton name='close' label={t('common.close')} onPress={onClose} color={colors.text} />}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingLeft: 14, paddingVertical: 6, marginHorizontal: 12, marginVertical: 6, minHeight: 48 },
  text: { flex: 1, fontSize: 15, lineHeight: 21, paddingVertical: 6 },
});

export default ErrorBanner;
