import { startTransition, type FormEvent } from "react";

// Submits a form to a useActionState action without React's automatic form
// reset, so typed input survives a validation error. Clear the form yourself
// on success (for example by changing its key).
export function submitWithoutReset(e: FormEvent<HTMLFormElement>, action: (data: FormData) => void) {
  e.preventDefault();
  const data = new FormData(e.currentTarget);
  startTransition(() => action(data));
}
