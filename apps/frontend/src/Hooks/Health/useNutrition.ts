import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { healthErrorMessage } from "./healthErrors";
import type { MealEstimate, MealPayload, NutritionData } from "./healthLogTypes";

export const useNutrition = (days: number) => {
  const [data, setData] = useState<NutritionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchNutrition = async () => {
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Nutrition_Endpoint(), { params: { days }, withCredentials: true });
      setData(response.data);
    } catch (error) {
      setError(healthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNutrition();
  }, [days]);

  const estimateMeal = async (text: string, photo: File | null): Promise<{ estimate: MealEstimate | null; error: string | null }> => {
    setEstimating(true);
    try {
      const form = new FormData();
      form.append('text', text);
      if (photo) form.append('photo', photo);
      const response = await http.post(End_Points.Health_Meal_Estimate_Endpoint(), form, { withCredentials: true });
      return { estimate: response.data, error: null };
    } catch (error) {
      return { estimate: null, error: healthErrorMessage(error) };
    } finally {
      setEstimating(false);
    }
  };

  const saveMeal = async (payload: MealPayload, options: { id?: string; photo?: File | null }): Promise<string | null> => {
    setSaving(true);
    try {
      const response = options.id
        ? await http.put(End_Points.Health_Meal_By_Id_Endpoint(options.id), payload, { withCredentials: true })
        : await http.post(End_Points.Health_Meals_Endpoint(), payload, { withCredentials: true });
      if (options.photo) {
        const form = new FormData();
        form.append('photo', options.photo);
        await http.post(End_Points.Health_Meal_Photo_Endpoint(response.data.id), form, { withCredentials: true });
      }
      setAlert({ open: true, message: i18n.t('health:nutrition.saved'), type: 'success' });
      await fetchNutrition();
      return null;
    } catch (error) {
      await fetchNutrition();
      return healthErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeMeal = async (id: string) => {
    try {
      await http.delete(End_Points.Health_Meal_By_Id_Endpoint(id), { withCredentials: true });
      await fetchNutrition();
    } catch (error) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    }
  };

  return { data, loading, saving, estimating, error, estimateMeal, saveMeal, removeMeal };
};
