import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { healthErrorMessage } from "./healthErrors";
import type {
  BodyMeasurement,
  BodyMeasurementPayload,
  PhotoPose,
  ProgressPhoto,
  VitalPayload,
  VitalReading,
} from "./healthLogTypes";

export interface ProgressPhotoUpload {
  file: File;
  day: string;
  pose: PhotoPose;
  notes: string | null;
}

const bodyErrorMessage = (error: any): string =>
  error?.response?.data?.code === 'HEALTH_BODY_EMPTY' ? i18n.t('health:body.measurements.emptyError') : healthErrorMessage(error);

export const useBody = (days: number) => {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAlert } = useAlert();

  const fetchBody = async () => {
    setError(null);
    try {
      const response = await http.get(End_Points.Health_Body_Endpoint(), { params: { days }, withCredentials: true });
      setMeasurements(response.data.measurements);
      setPhotos(response.data.photos);
      setVitals(response.data.vitals);
    } catch (error: any) {
      setError(healthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBody();
  }, [days]);

  const saveMeasurement = async (payload: BodyMeasurementPayload): Promise<string | null> => {
    setSaving(true);
    try {
      await http.put(End_Points.Health_Body_Measurements_Endpoint(), payload, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('health:body.measurements.saved'), type: 'success' });
      await fetchBody();
      return null;
    } catch (error: any) {
      return bodyErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeMeasurement = async (id: string) => {
    try {
      await http.delete(End_Points.Health_Body_Measurement_By_Id_Endpoint(id), { withCredentials: true });
      await fetchBody();
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    }
  };

  const uploadPhoto = async (upload: ProgressPhotoUpload): Promise<string | null> => {
    setSaving(true);
    try {
      const form = new FormData();
      form.append('photo', upload.file);
      form.append('day', upload.day);
      form.append('pose', upload.pose);
      if (upload.notes) form.append('notes', upload.notes);
      await http.post(End_Points.Health_Body_Photos_Endpoint(), form, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('health:body.photos.saved'), type: 'success' });
      await fetchBody();
      return null;
    } catch (error: any) {
      return healthErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = async (id: string) => {
    try {
      await http.delete(End_Points.Health_Body_Photo_By_Id_Endpoint(id), { withCredentials: true });
      await fetchBody();
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    }
  };

  const addVital = async (payload: VitalPayload): Promise<string | null> => {
    setSaving(true);
    try {
      await http.post(End_Points.Health_Vitals_Endpoint(), payload, { withCredentials: true });
      setAlert({ open: true, message: i18n.t('health:body.vitals.saved'), type: 'success' });
      await fetchBody();
      return null;
    } catch (error: any) {
      return healthErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  const removeVital = async (id: string) => {
    try {
      await http.delete(End_Points.Health_Vital_By_Id_Endpoint(id), { withCredentials: true });
      await fetchBody();
    } catch (error: any) {
      setAlert({ open: true, message: healthErrorMessage(error), type: 'error' });
    }
  };

  return {
    measurements,
    photos,
    vitals,
    loading,
    saving,
    error,
    saveMeasurement,
    removeMeasurement,
    uploadPhoto,
    removePhoto,
    addVital,
    removeVital,
  };
};
