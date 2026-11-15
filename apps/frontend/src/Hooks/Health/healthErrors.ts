import i18n from "../../i18n";

export const healthErrorMessage = (error: any): string => {
  const data = error?.response?.data;
  if (data?.code && i18n.exists(`settings:ai.errors.${data.code}`)) return i18n.t(`settings:ai.errors.${data.code}`);
  const message = Array.isArray(data?.message) ? data.message.join(' ') : data?.message;
  return message || error?.message || i18n.t('common:errors.generic');
};
