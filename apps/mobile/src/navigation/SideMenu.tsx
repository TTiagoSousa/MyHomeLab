import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Icon, { type IconName } from '../components/Icon';
import JarvisMark from '../components/JarvisMark';
import { useAuth } from '../context/AuthContext';
import { useMenu } from '../context/MenuContext';
import { useColors } from '../theme/useColors';
import { appVersion } from '../utils/version';
import { navigationRef, type RootStackParams } from './routes';

type MenuRoute = 'Assistant' | 'QuickLog';

const ITEMS: { route: MenuRoute; icon: IconName; label: string }[] = [
  { route: 'Assistant', icon: 'assistant', label: 'nav.assistant' },
  { route: 'QuickLog', icon: 'quick', label: 'nav.quickLog' },
];

const SideMenu = () => {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { open, closeMenu } = useMenu();
  const { user, signOut } = useAuth();
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<keyof RootStackParams>('Assistant');
  const panelWidth = Math.min(320, width * 0.82);
  const offset = useRef(new Animated.Value(-panelWidth)).current;

  useEffect(() => {
    if (open) {
      setCurrent(navigationRef.isReady() ? (navigationRef.getCurrentRoute()?.name ?? 'Assistant') : 'Assistant');
      setVisible(true);
      Animated.timing(offset, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(offset, { toValue: -panelWidth, duration: 180, useNativeDriver: true }).start(() =>
        setVisible(false),
      );
    }
  }, [open]);

  const go = (route: MenuRoute) => {
    closeMenu();
    if (navigationRef.isReady()) navigationRef.reset({ index: 0, routes: [{ name: route }] });
  };

  const leave = () => {
    closeMenu();
    signOut();
  };

  return (
    <Modal visible={visible} transparent animationType='none' onRequestClose={closeMenu} statusBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={closeMenu} />
      <Animated.View
        style={[
          styles.panel,
          {
            width: panelWidth,
            backgroundColor: colors.surface,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
            transform: [{ translateX: offset }],
          },
        ]}
      >
        <View style={styles.head}>
          <JarvisMark size={48} />
          <View style={styles.headText}>
            <Text style={[styles.brand, { color: colors.text }]}>MyHomeLab</Text>
            {user && (
              <Text style={[styles.user, { color: colors.textSoft }]}>{t('nav.signedInAs', { name: user.username })}</Text>
            )}
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {ITEMS.map((item) => {
          const active = current === item.route;
          return (
            <Pressable
              key={item.route}
              onPress={() => go(item.route)}
              style={[styles.item, active && { backgroundColor: colors.accentSoft }]}
            >
              <Icon name={item.icon} color={active ? colors.accent : colors.textSoft} />
              <Text style={[styles.itemText, { color: active ? colors.text : colors.textSoft }]}>{t(item.label)}</Text>
            </Pressable>
          );
        })}

        <View style={styles.spacer} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Pressable onPress={leave} style={styles.item}>
          <Icon name='logout' color={colors.textSoft} />
          <Text style={[styles.itemText, { color: colors.textSoft }]}>{t('nav.logout')}</Text>
        </Pressable>
        <Text style={[styles.version, { color: colors.textSoft }]}>{t('nav.version', { version: appVersion() })}</Text>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill },
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, paddingHorizontal: 12, borderTopRightRadius: 20, borderBottomRightRadius: 20 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 8, paddingBottom: 16 },
  headText: { flex: 1 },
  brand: { fontSize: 20, fontWeight: '700' },
  user: { fontSize: 14, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 16, height: 52, paddingHorizontal: 16, borderRadius: 26 },
  itemText: { fontSize: 16, fontWeight: '500' },
  spacer: { flex: 1 },
  version: { fontSize: 13, paddingHorizontal: 16, paddingTop: 10 },
});

export default SideMenu;
