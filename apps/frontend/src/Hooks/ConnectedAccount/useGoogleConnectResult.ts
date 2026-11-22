import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import i18n from "../../i18n";
import { useAlert } from "../../Contexts/Alert_Context";

export const useGoogleConnectResult = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setAlert } = useAlert();
  const result = searchParams.get("google");

  useEffect(() => {
    if (result !== "cancelled" && result !== "failed") return;
    setAlert({
      open: true,
      message: i18n.t(`addons:google.${result}`),
      type: result === "cancelled" ? "warning" : "error",
    });
    const next = new URLSearchParams(searchParams);
    next.delete("google");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
};
