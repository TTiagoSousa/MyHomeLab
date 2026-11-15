import { useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import { useAlert } from "../../Contexts/Alert_Context";
import type { ServiceHosting } from "../Categories/useCategories";

export interface UpdateServicePayload {
  name?: string;
  link?: string;
  categoryId?: string;
  color?: string;
  isFavorite?: boolean;
  hosting?: ServiceHosting;
}

export interface CreateServicePayload {
  name: string;
  link: string;
  abbreviation: string;
  color: string;
  categoryId: string;
  hosting?: ServiceHosting;
}

export const useService = () => {
  const [loading, setLoading] = useState(false);
  const { setAlert } = useAlert();

  const createService = async (data: CreateServicePayload) => {
    setLoading(true);
    try {
      await http.post(End_Points.Service_Create_Endpoint(), data, { withCredentials: true });
      setAlert({ open: true, message: i18n.t("services:alerts.serviceCreated"), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t("common:errors.generic");
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateService = async (id: string, data: UpdateServicePayload, silent = false) => {
    setLoading(true);
    try {
      await http.patch(End_Points.Service_Endpoint(id), data, { withCredentials: true });
      if (!silent) {
        setAlert({ open: true, message: i18n.t("services:alerts.serviceUpdated"), type: 'success' });
      }
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t("common:errors.generic");
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteService = async (id: string) => {
    setLoading(true);
    try {
      await http.delete(End_Points.Service_Endpoint(id), { withCredentials: true });
      setAlert({ open: true, message: i18n.t("services:alerts.serviceDeleted"), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t("common:errors.generic");
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const reorderServices = async (categoryId: string, orderedIds: string[]) => {
    try {
      await http.patch(
        End_Points.Service_Reorder_Endpoint(),
        { categoryId, orderedIds },
        { withCredentials: true },
      );
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t("common:errors.generic");
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    }
  };

  return { createService, updateService, deleteService, reorderServices, loading };
};
