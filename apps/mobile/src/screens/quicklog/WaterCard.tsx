import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from '../../components/Icon';
import PrimaryButton from '../../components/PrimaryButton';
import TextField from '../../components/TextField';
import { useColors } from '../../theme/useColors';
import { formatDay, formatNumber, localDay, shiftDay } from '../../utils/format';
import QuickButton from './QuickButton';
import QuickCard from './QuickCard';

const AMOUNTS = [250, 330, 500];

interface WaterCardProps {
  day: string;
  isToday: boolean;
  canGoBack: boolean;
  dayMl: number;
  goalMl: number | null;
  canUndo: boolean;
  saving: boolean;
  onAdd: (ml: number) => void;
  onUndo: () => void;
  onChangeDay: (days: number) => void;
  onToday: () => void;
}

const WaterCard = ({
  day,
  isToday,
  canGoBack,
  dayMl,
  goalMl,
  canUndo,
  saving,
  onAdd,
  onUndo,
  onChangeDay,
  onToday,
}: WaterCardProps) => {
  const { t } = useTranslation();
  const colors = useColors();
  const [custom, setCustom] = useState('');
  const customMl = Math.round(Number(custom.replace(',', '.')));
  const validCustom = Number.isFinite(customMl) && customMl >= 1 && customMl <= 5000;
  const progress = goalMl ? Math.min(1, dayMl / goalMl) : 0;
  const isYesterday = shiftDay(day, 1) === localDay(new Date());
  const dayLabel = isToday
    ? t('quick.water.todayLabel')
    : isYesterday
      ? t('quick.water.yesterdayLabel')
      : formatDay(day);

  const addCustom = () => {
    if (!validCustom) return;
    onAdd(customMl);
    setCustom('');
  };

  return (
    <QuickCard
      title={t('quick.water.title')}
      summary={
        goalMl
          ? t('quick.water.totalGoal', { ml: formatNumber(dayMl, 0), goal: formatNumber(goalMl, 0) })
          : t('quick.water.total', { ml: formatNumber(dayMl, 0) })
      }
    >
      <View style={[styles.dayRow, { backgroundColor: colors.surfaceHigh }]}>
        <Pressable
          onPress={() => onChangeDay(-1)}
          disabled={!canGoBack || saving}
          hitSlop={8}
          accessibilityLabel={t('quick.water.previousDay')}
          style={[styles.dayArrow, !canGoBack && styles.dayArrowOff]}
        >
          <Icon name='chevronLeft' color={colors.text} />
        </Pressable>
        <Pressable onPress={onToday} disabled={isToday || saving} style={styles.dayCenter}>
          <Text style={[styles.dayText, { color: isToday ? colors.text : colors.accent }]}>{dayLabel}</Text>
          {!isToday && <Text style={[styles.dayHint, { color: colors.textSoft }]}>{t('quick.water.backToToday')}</Text>}
        </Pressable>
        <Pressable
          onPress={() => onChangeDay(1)}
          disabled={isToday || saving}
          hitSlop={8}
          accessibilityLabel={t('quick.water.nextDay')}
          style={[styles.dayArrow, isToday && styles.dayArrowOff]}
        >
          <Icon name='chevronRight' color={colors.text} />
        </Pressable>
      </View>
      {goalMl ? (
        <View style={[styles.track, { backgroundColor: colors.surfaceHigh }]}>
          <View style={[styles.fill, { backgroundColor: colors.accent, width: `${progress * 100}%` }]} />
        </View>
      ) : null}
      <View style={styles.row}>
        {AMOUNTS.map((ml) => (
          <QuickButton key={ml} label={`+${ml} ml`} onPress={() => onAdd(ml)} disabled={saving} />
        ))}
      </View>
      <View style={styles.customRow}>
        <View style={styles.customField}>
          <TextField
            label={t('quick.water.custom')}
            value={custom}
            onChangeText={setCustom}
            keyboardType='number-pad'
            placeholder='ml'
            returnKeyType='done'
            onSubmitEditing={addCustom}
          />
        </View>
        <PrimaryButton label={t('quick.add')} onPress={addCustom} disabled={!validCustom || saving} />
      </View>
      {canUndo ? (
        <Text style={[styles.undo, { color: colors.accent }]} onPress={saving ? undefined : onUndo}>
          {t('quick.water.undo')}
        </Text>
      ) : null}
    </QuickCard>
  );
};

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  dayRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 6 },
  dayArrow: { padding: 6 },
  dayArrowOff: { opacity: 0.3 },
  dayCenter: { flex: 1, alignItems: 'center' },
  dayText: { fontSize: 16, fontWeight: '700' },
  dayHint: { fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', gap: 10 },
  customRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  customField: { flex: 1 },
  undo: { fontSize: 15, fontWeight: '600', alignSelf: 'flex-start', paddingVertical: 4 },
});

export default WaterCard;
