import i18n from "../../i18n";

export const monitorErrorMessage = (error: any): string => {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  return message || error?.message || i18n.t('common:errors.generic');
};
