import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { docErrorMessage } from "./docErrorMessage";
import type { Doc, DocFilters, DocPayload, DocSummary } from "./docTypes";

export const useDocs = (filters: DocFilters) => {
  const filtersKey = JSON.stringify([filters.search, filters.kind, filters.linkType, filters.targetId, filters.owner, filters.sort]);
  const [result, setResult] = useState<{ filtersKey: string; docs: DocSummary[] }>({ filtersKey, docs: [] });
  const [loading, setLoading] = useState(true);
  const [creatingStarter, setCreatingStarter] = useState(false);
  const [refreshingMaps, setRefreshingMaps] = useState(false);
  const [error, setError] = useState('');
  const { setAlert } = useAlert();

  const fetchDocs = async () => {
    try {
      const response = await http.get(End_Points.Docs_Endpoint(), {
        params: {
          search: filters.search || undefined,
          kind: filters.kind || undefined,
          linkType: filters.linkType || undefined,
          targetId: filters.targetId || undefined,
          owner: filters.owner || undefined,
          sort: filters.sort === 'title' ? 'title' : undefined,
        },
        withCredentials: true,
      });
      setResult((current) => (current.filtersKey === filtersKey ? { filtersKey, docs: response.data } : current));
      setError('');
    } catch (error: any) {
      setError(docErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setResult((current) => ({ filtersKey, docs: current.docs }));
    fetchDocs();
  }, [filtersKey]);

  const createDoc = async (payload: DocPayload): Promise<Doc | null> => {
    try {
      const response = await http.post(End_Points.Docs_Endpoint(), payload, { withCredentials: true });
      await fetchDocs();
      setAlert({ open: true, message: i18n.t('docs:alerts.created'), type: 'success' });
      return response.data;
    } catch (error: any) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
      return null;
    }
  };

  const createStarterDocs = async () => {
    setCreatingStarter(true);
    try {
      const response = await http.post(End_Points.Docs_Starter_Endpoint(), {}, { withCredentials: true });
      const created: Doc[] = response.data;
      await fetchDocs();
      const message = created.length
        ? i18n.t('docs:alerts.starterCreated', { count: created.length })
        : i18n.t('docs:alerts.starterNone');
      setAlert({ open: true, message, type: created.length ? 'success' : 'info' });
    } catch (error: any) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
    } finally {
      setCreatingStarter(false);
    }
  };

  const refreshMaps = async () => {
    setRefreshingMaps(true);
    try {
      const response = await http.post(End_Points.Docs_Maps_Refresh_Endpoint(), {}, { withCredentials: true });
      await fetchDocs();
      setAlert({ open: true, message: i18n.t('docs:alerts.mapsRefreshed', { count: response.data.written }), type: 'success' });
    } catch (error) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
    } finally {
      setRefreshingMaps(false);
    }
  };

  const createFromTemplate = async (id: string) => {
    setCreatingStarter(true);
    try {
      const response = await http.post(End_Points.Docs_Template_Endpoint(id), {}, { withCredentials: true });
      const created: Doc[] = response.data;
      await fetchDocs();
      const message = created.length
        ? i18n.t('docs:alerts.starterCreated', { count: created.length })
        : i18n.t('docs:alerts.starterNone');
      setAlert({ open: true, message, type: created.length ? 'success' : 'info' });
    } catch (error) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
    } finally {
      setCreatingStarter(false);
    }
  };

  return { docs: result.docs, loading, error, creatingStarter, refreshingMaps, fetchDocs, createDoc, createStarterDocs, createFromTemplate, refreshMaps };
};
