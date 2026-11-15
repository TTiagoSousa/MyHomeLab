import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import IconButton from './IconButton';
import { useMenu } from '../context/MenuContext';
import { useColors } from '../theme/useColors';

interface AppHeaderProps {
  title: string;
  onBack?: () => void;
  backIcon?: 'back' | 'close';
  right?: ReactNode;
}

const AppHeader = ({ title, onBack, backIcon = 'back', right }: AppHeaderProps) => {
  const { t } = useTranslation();
  const colors = useColors();
  const { openMenu } = useMenu();

  return (
    <View style={styles.header}>
      {onBack ? (
        <IconButton name={backIcon} label={t('common.back')} onPress={onBack} />
      ) : (
        <IconButton name='menu' label={t('nav.openMenu')} onPress={openMenu} />
      )}
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6, gap: 6 },
  title: { flex: 1, fontSize: 20, fontWeight: '600' },
  right: { flexDirection: 'row', alignItems: 'center' },
});

export default AppHeader;
