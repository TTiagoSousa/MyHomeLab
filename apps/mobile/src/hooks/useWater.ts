import { useEffect, useState } from 'react';
import * as api from '../api/endpoints';
import { errorText } from '../api/errorText';
import type { WaterData } from '../api/types';
import { localDay, offsetOf, shiftDay } from '../utils/format';

const MAX_DAYS_BACK = 30;

export const useWater = () => {
  const [data, setData] = useState<WaterData | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = localDay(new Date());
  const day = pickedDay ?? today;

  const fetchWater = async () => {
    try {
      setData(await api.water());
      setError(null);
    } catch (fetchError) {
      setError(errorText(fetchError));
    }
  };

  useEffect(() => {
    fetchWater();
  }, []);

  const addWater = async (ml: number) => {
    setSaving(true);
    try {
      const now = new Date();
      const [year, month, date] = day.split('-').map(Number);
      const drankAt = new Date(now);
      drankAt.setFullYear(year, month - 1, date);
      const added = await api.addWater(ml, drankAt.toISOString(), offsetOf(drankAt));
      setAddedId(added.id);
      await fetchWater();
      setError(null);
      return true;
    } catch (saveError) {
      setError(errorText(saveError));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const removeWater = async (id: string) => {
    setSaving(true);
    try {
      await api.removeWater(id);
      await fetchWater();
      setError(null);
      return true;
    } catch (removeError) {
      setError(errorText(removeError));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const selected = data?.days.find((entry) => entry.day === day) ?? null;
  const lastEntry =
    selected?.entries.find((entry) => entry.id === addedId) ?? selected?.entries[selected.entries.length - 1] ?? null;

  const changeDay = (days: number) => {
    const next = shiftDay(day, days);
    if (next <= today && next >= shiftDay(today, -MAX_DAYS_BACK)) setPickedDay(next === today ? null : next);
  };

  return {
    day,
    isToday: day === today,
    canGoBack: day > shiftDay(today, -MAX_DAYS_BACK),
    dayMl: selected?.ml ?? 0,
    goalMl: data?.averages?.goalMl ?? null,
    lastEntry,
    saving,
    error,
    fetchWater,
    changeDay,
    resetDay: () => setPickedDay(null),
    addWater,
    removeWater,
  };
};
