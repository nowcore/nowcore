import { LocalStore, SupabaseStore, type ObjectStore } from '@nowcore/storage';
import { ENV, type Env } from '../../env.js';

/** Uploaded print files (T-035): local `.storage/` or the private Supabase bucket "artwork". */
export const ARTWORK_STORE = Symbol('ARTWORK_STORE');

export const artworkStoreProvider = {
  provide: ARTWORK_STORE,
  inject: [ENV],
  useFactory: (env: Env): ObjectStore =>
    env.STORAGE === 'supabase'
      ? new SupabaseStore(
          env.SUPABASE_URL as string,
          env.SUPABASE_SECRET_KEY as string,
          'artwork',
        )
      : new LocalStore(env.STORAGE_DIR),
};
