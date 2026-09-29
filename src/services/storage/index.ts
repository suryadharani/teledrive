import { IStorageProvider, StorageProviderType } from '../../types';
import { MockStorageProvider } from './MockStorageProvider';
import { LocalCompanionStorageProvider } from './LocalCompanionStorageProvider';
import { TelegramMTProtoStorageProvider } from './TelegramMTProtoStorageProvider';

class StorageProviderRegistry {
  private providers: Map<StorageProviderType, IStorageProvider> = new Map();
  private activeProviderId: StorageProviderType = 'local_companion';

  constructor() {
    const mock = new MockStorageProvider();
    const companion = new LocalCompanionStorageProvider();
    const mtproto = new TelegramMTProtoStorageProvider();

    this.providers.set('mock', mock);
    this.providers.set('local_companion', companion);
    this.providers.set('telegram', mtproto);

    const configured = (import.meta.env.VITE_DEFAULT_STORAGE_PROVIDER as StorageProviderType) || 'local_companion';
    if (configured && this.providers.has(configured)) {
      this.activeProviderId = configured;
    }
  }

  public getActiveProvider(): IStorageProvider {
    return this.providers.get(this.activeProviderId) || this.providers.get('mock')!;
  }

  public getProvider(id: StorageProviderType): IStorageProvider | undefined {
    return this.providers.get(id);
  }

  public getAllProviders(): IStorageProvider[] {
    return Array.from(this.providers.values());
  }

  public setActiveProvider(id: StorageProviderType): void {
    if (this.providers.has(id)) {
      this.activeProviderId = id;
    }
  }

  public getActiveProviderId(): StorageProviderType {
    return this.activeProviderId;
  }
}

export const storageRegistry = new StorageProviderRegistry();
export { MockStorageProvider, LocalCompanionStorageProvider, TelegramMTProtoStorageProvider };
