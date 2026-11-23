export interface StoreContext {
  directory: string;
  pending: Promise<unknown>;
}
