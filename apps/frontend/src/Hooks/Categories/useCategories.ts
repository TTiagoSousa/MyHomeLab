import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";

export type ServiceHosting = 'SELF_HOSTED' | 'CLOUD';

export interface Service {
  id: string;
  name: string;
  link: string;
  abbreviation: string;
  color: string;
  isFavorite: boolean;
  hosting: ServiceHosting;
  order: number;
  categoryId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryWithServices {
  id: string;
  name: string;
  order: number;
  userId: string;
  createdAt: string;
  servicesCount: number;
  services: Service[];
}

export const useCategories = () => {
  const [categories, setCategories] = useState<CategoryWithServices[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await http.get(End_Points.Category_With_Services_Endpoint(), {
        withCredentials: true,
      });
      setCategories(response.data);
      setError('');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t("common:errors.generic");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return { categories, loading, error, fetchCategories };
};
