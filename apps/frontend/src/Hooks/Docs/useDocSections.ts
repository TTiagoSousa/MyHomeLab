import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import { useAlert } from '../../Contexts/Alert_Context';
import { docErrorMessage } from './docErrorMessage';
import type { DocSection } from './docTypes';

export const useDocSections = () => {
  const [sections, setSections] = useState<DocSection[]>([]);
  const { setAlert } = useAlert();

  const fetchSections = async () => {
    try {
      const response = await http.get(End_Points.Docs_Sections_Endpoint(), { withCredentials: true });
      setSections(response.data);
    } catch (error) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
    }
  };

  useEffect(() => {
    void fetchSections();
  }, []);

  const createSection = async (name: string, parentId: string | null) => {
    try {
      const response = await http.post(End_Points.Docs_Sections_Endpoint(), { name, parentId }, { withCredentials: true });
      await fetchSections();
      return response.data as DocSection;
    } catch (error) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
      return null;
    }
  };

  const updateSection = async (id: string, changes: { name?: string; parentId?: string | null }) => {
    try {
      await http.patch(End_Points.Docs_Section_Endpoint(id), changes, { withCredentials: true });
      await fetchSections();
      return true;
    } catch (error) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
      return false;
    }
  };

  const deleteSection = async (id: string) => {
    try {
      await http.delete(End_Points.Docs_Section_Endpoint(id), { withCredentials: true });
      await fetchSections();
      return true;
    } catch (error) {
      setAlert({ open: true, message: docErrorMessage(error), type: 'error' });
      return false;
    }
  };

  return { sections, fetchSections, createSection, updateSection, deleteSection };
};
