import { observable } from "@legendapp/state";

export const authState = observable({
  user: null as { id: string; email: string; role: string } | null,
  loading: false,
  error: "" as string,
});
