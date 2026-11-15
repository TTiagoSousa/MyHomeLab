import { useState } from 'react';
import { KeyboardAvoidingView, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import AppHeader from '../../components/AppHeader';
import ErrorBanner from '../../components/ErrorBanner';
import Toast from '../../components/Toast';
import UpdateBanner from '../../components/UpdateBanner';
import { useWater } from '../../hooks/useWater';
import { useColors } from '../../theme/useColors';
import { formatDay, formatNumber } from '../../utils/format';
import WaterCard from './WaterCard';

const QuickLogScreen = () => {
  const { t } = useTranslation();
  const colors = useColors();
  const water = useWater();
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const error = water.error;

  const done = (message: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setToast(message);
  };

  const addWater = async (ml: number) => {
    if (!(await water.addWater(ml))) return;
    done(
      water.isToday
        ? t('quick.water.added', { ml: formatNumber(ml, 0) })
        : t('quick.water.addedOn', { ml: formatNumber(ml, 0), day: formatDay(water.day) }),
    );
  };

  const undoWater = async () => {
    if (water.lastEntry && (await water.removeWater(water.lastEntry.id))) done(t('quick.removed'));
  };

  const refresh = async () => {
    setRefreshing(true);
    await water.fetchWater();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <AppHeader title={t('quick.title')} />
      <UpdateBanner />
      {error && <ErrorBanner message={error} />}
      <KeyboardAvoidingView style={styles.screen} behavior='height'>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps='handled'
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              colors={[colors.accent]}
              progressBackgroundColor={colors.surface}
            />
          }
        >
          <WaterCard
            day={water.day}
            isToday={water.isToday}
            canGoBack={water.canGoBack}
            dayMl={water.dayMl}
            goalMl={water.goalMl}
            canUndo={water.lastEntry !== null}
            saving={water.saving}
            onAdd={addWater}
            onUndo={undoWater}
            onChangeDay={water.changeDay}
            onToday={water.resetDay}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast message={toast} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingTop: 4, gap: 14, paddingBottom: 96 },
});

export default QuickLogScreen;
