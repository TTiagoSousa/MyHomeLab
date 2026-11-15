import i18n from "../../i18n";

export const todoErrorMessage = (error: any) =>
  error.response?.data?.message || error.message || i18n.t('common:errors.generic');
