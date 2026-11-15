import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useUpdate } from '../context/UpdateContext';
import { useColors } from '../theme/useColors';

const UpdateBanner = () => {
  const { t } = useTranslation();
  const colors = useColors();
  const { release, dismiss } = useUpdate();
  if (!release?.version || !release.downloadUrl) return null;
  const downloadUrl = release.downloadUrl;

  return (
    <View style={[styles.banner, { backgroundColor: colors.accentSoft }]}>
      <Text style={[styles.text, { color: colors.text }]}>
        {t('update.available', { version: release.version.replace(/^v/, '') })}
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={dismiss} hitSlop={6}>
          <Text style={[styles.action, { color: colors.textSoft }]}>{t('update.dismiss')}</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(downloadUrl)} hitSlop={6}>
          <Text style={[styles.action, { color: colors.accent }]}>{t('update.download')}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: { borderRadius: 12, padding: 14, marginHorizontal: 12, marginVertical: 6, gap: 8 },
  text: { fontSize: 15, lineHeight: 21 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24 },
  action: { fontSize: 15, fontWeight: '600' },
});

export default UpdateBanner;
