export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface AsyncResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  status: AsyncStatus;
}

export interface AsyncCollectionState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  status: AsyncStatus;
}

export interface MutationState {
  loading: boolean;
  error: string | null;
  success: boolean;
}