import { useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import { useAlert } from "../../Contexts/Alert_Context";
import type {
  HuaweiHeartImportResult,
  HuaweiHeartPayload,
  HuaweiImportResult,
  HuaweiSkinTemperatureImportResult,
  HuaweiSkinTemperaturePayload,
  HuaweiBloodOxygenImportResult,
  HuaweiBloodOxygenPayload,
  HuaweiStressImportResult,
  HuaweiStressPayload,
  HuaweiExerciseImportResult,
  HuaweiStepsImportResult,
  ActivityMinute,
  HuaweiWorkoutRecord,
} from "./healthTypes";

export const useHealthImport = () => {
  const [importing, setImporting] = useState(false);
  const { setAlert } = useAlert();

  const showError = (error: any) => {
    setAlert({ open: true, message: error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'), type: 'error' });
  };

  const importHuaweiSleep = async (files: File[]): Promise<HuaweiImportResult | null> => {
    try {
      const form = new FormData();
      files.forEach((file) => form.append('files', file, file.name));
      const response = await http.post(End_Points.Health_Import_Huawei_Endpoint(), form, { withCredentials: true });
      return response.data;
    } catch (error: any) {
      showError(error);
      return null;
    }
  };

  const importHuaweiHeart = async (payload: HuaweiHeartPayload): Promise<HuaweiHeartImportResult | null> => {
    try {
      const form = new FormData();
      form.append('file', new Blob([JSON.stringify(payload)], { type: 'application/json' }), 'heart-rate.json');
      const response = await http.post(End_Points.Health_Import_Huawei_Heart_Endpoint(), form, { withCredentials: true });
      return response.data;
    } catch (error: any) {
      showError(error);
      return null;
    }
  };

  const importHuaweiSkinTemperature = async (
    payload: HuaweiSkinTemperaturePayload,
  ): Promise<HuaweiSkinTemperatureImportResult | null> => {
    try {
      const form = new FormData();
      form.append('file', new Blob([JSON.stringify(payload)], { type: 'application/json' }), 'skin-temperature.json');
      const response = await http.post(End_Points.Health_Import_Huawei_Skin_Temperature_Endpoint(), form, { withCredentials: true });
      return response.data;
    } catch (error: any) {
      showError(error);
      return null;
    }
  };

  const importHuaweiBloodOxygen = async (payload: HuaweiBloodOxygenPayload): Promise<HuaweiBloodOxygenImportResult | null> => {
    try {
      const form = new FormData();
      form.append('file', new Blob([JSON.stringify(payload)], { type: 'application/json' }), 'blood-oxygen.json');
      const response = await http.post(End_Points.Health_Import_Huawei_Blood_Oxygen_Endpoint(), form, { withCredentials: true });
      return response.data;
    } catch (error: any) {
      showError(error);
      return null;
    }
  };

  const importHuaweiStress = async (payload: HuaweiStressPayload): Promise<HuaweiStressImportResult | null> => {
    try {
      const form = new FormData();
      form.append('file', new Blob([JSON.stringify(payload)], { type: 'application/json' }), 'stress.json');
      const response = await http.post(End_Points.Health_Import_Huawei_Stress_Endpoint(), form, { withCredentials: true });
      return response.data;
    } catch (error: any) {
      showError(error);
      return null;
    }
  };

  const importHuaweiSteps = async (activity: ActivityMinute[]): Promise<HuaweiStepsImportResult | null> => {
    try {
      const form = new FormData();
      form.append('file', new Blob([JSON.stringify({ activity })], { type: 'application/json' }), 'steps.json');
      const response = await http.post(End_Points.Health_Import_Huawei_Steps_Endpoint(), form, { withCredentials: true });
      return response.data;
    } catch (error: any) {
      showError(error);
      return null;
    }
  };

  const importHuaweiExercise = async (workouts: HuaweiWorkoutRecord[]): Promise<HuaweiExerciseImportResult | null> => {
    try {
      const form = new FormData();
      form.append('file', new Blob([JSON.stringify({ workouts })], { type: 'application/json' }), 'exercise.json');
      const response = await http.post(End_Points.Health_Import_Huawei_Exercise_Endpoint(), form, { withCredentials: true });
      return response.data;
    } catch (error: any) {
      showError(error);
      return null;
    }
  };

  return {
    importing,
    setImporting,
    importHuaweiSleep,
    importHuaweiHeart,
    importHuaweiSkinTemperature,
    importHuaweiBloodOxygen,
    importHuaweiStress,
    importHuaweiSteps,
    importHuaweiExercise,
  };
};
