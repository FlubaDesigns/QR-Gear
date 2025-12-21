import { useState, useCallback } from "react";

type ButtonState = "idle" | "loading" | "success" | "error";

interface UseButtonStateOptions {
  successDuration?: number;
  errorDuration?: number;
}

export function useButtonState(options: UseButtonStateOptions = {}) {
  const { successDuration = 1500, errorDuration = 1500 } = options;
  const [state, setState] = useState<ButtonState>("idle");

  const execute = useCallback(
    async <T>(asyncFn: () => Promise<T>): Promise<T | null> => {
      setState("loading");
      try {
        const result = await asyncFn();
        setState("success");
        setTimeout(() => setState("idle"), successDuration);
        return result;
      } catch (err) {
        setState("error");
        setTimeout(() => setState("idle"), errorDuration);
        throw err;
      }
    },
    [successDuration, errorDuration]
  );

  const reset = useCallback(() => setState("idle"), []);

  return {
    state,
    isLoading: state === "loading",
    isSuccess: state === "success",
    isError: state === "error",
    isIdle: state === "idle",
    execute,
    reset,
  };
}
