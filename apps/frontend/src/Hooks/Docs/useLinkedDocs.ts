import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { docErrorMessage } from "./docErrorMessage";
import type { Doc, DocLinkType } from "./docTypes";

export const useLinkedDocs = (type: DocLinkType, targetId: string | undefined) => {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLinkedDocs = async () => {
    if (!targetId) return;
    try {
      const response = await http.get(End_Points.Docs_Linked_Endpoint(), {
        params: { type, targetId },
        withCredentials: true,
      });
      setDocs(response.data);
      setError('');
    } catch (error: any) {
      setError(docErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinkedDocs();
  }, [type, targetId]);

  return { docs, loading, error, fetchLinkedDocs };
};
