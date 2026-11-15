import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import { todoErrorMessage } from "./todoErrorMessage";
import type { Todo, TodoPayload } from "./todoTypes";

export const useTodos = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const { setAlert } = useAlert();

  const fetchTodos = async () => {
    try {
      const response = await http.get(End_Points.Todos_Endpoint(), { withCredentials: true });
      setTodos(response.data);
      setError('');
    } catch (error: any) {
      setError(todoErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  const createTodo = async (payload: TodoPayload): Promise<Todo | null> => {
    setSavingId('new');
    try {
      const response = await http.post(End_Points.Todos_Endpoint(), payload, { withCredentials: true });
      await fetchTodos();
      return response.data;
    } catch (error: any) {
      setAlert({ open: true, message: todoErrorMessage(error), type: 'error' });
      return null;
    } finally {
      setSavingId('');
    }
  };

  const updateTodo = async (id: string, payload: TodoPayload): Promise<Todo | null> => {
    setSavingId(id);
    try {
      const response = await http.patch(End_Points.Todo_Endpoint(id), payload, { withCredentials: true });
      await fetchTodos();
      return response.data;
    } catch (error: any) {
      setAlert({ open: true, message: todoErrorMessage(error), type: 'error' });
      return null;
    } finally {
      setSavingId('');
    }
  };

  const deleteTodo = async (id: string) => {
    setSavingId(id);
    try {
      await http.delete(End_Points.Todo_Endpoint(id), { withCredentials: true });
      await fetchTodos();
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: todoErrorMessage(error), type: 'error' });
      return false;
    } finally {
      setSavingId('');
    }
  };

  return { todos, loading, error, savingId, fetchTodos, createTodo, updateTodo, deleteTodo };
};
